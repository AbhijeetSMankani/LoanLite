package com.loanlite.loanlite.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

// Calls the external random.org integer-generator API to stand in for the project charter's
// "outside checks" (backendTodo.csv task 5) - one call for credit score, one for verified income,
// each with its own min/max range agreed with the user. Returns null on any failure (timeout,
// non-2xx, a non-numeric body - random.org's plain-text API reports its own errors, e.g. quota
// exhaustion, as an HTTP 200 body starting with "Error:" rather than a non-2xx status, which a
// parse failure here catches the same as any other malformed response) rather than throwing -
// ProcessorController.claimApplication() falls back to manual staff entry per field when null,
// per the user's explicit choice not to block the claim on this external dependency.
@Service
public class OutsideCheckService {

    private static final Logger log = LoggerFactory.getLogger(OutsideCheckService.class);

    private static final String BASE_URL = "https://www.random.org/integers/";

    // Realistic CIBIL-style credit score scale, matches ProcessorController.verifyApplication()'s
    // existing >=700/>=650 recommendation thresholds.
    private static final int CREDIT_SCORE_MIN = 300;
    private static final int CREDIT_SCORE_MAX = 900;

    // No strong anchor in the codebase beyond straddling verifyApplication()'s existing
    // verifiedIncome >= 30000 threshold - agreed with the user as a reasonable range.
    private static final int VERIFIED_INCOME_MIN = 10000;
    private static final int VERIFIED_INCOME_MAX = 100000;

    private final RestTemplate restTemplate;

    public OutsideCheckService() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public Integer fetchCreditScore() {
        return fetchOutcome(CREDIT_SCORE_MIN, CREDIT_SCORE_MAX);
    }

    public Integer fetchVerifiedIncome() {
        return fetchOutcome(VERIFIED_INCOME_MIN, VERIFIED_INCOME_MAX);
    }

    private Integer fetchOutcome(int min, int max) {
        String url = UriComponentsBuilder.fromUriString(BASE_URL)
                .queryParam("num", 1)
                .queryParam("min", min)
                .queryParam("max", max)
                .queryParam("col", 1)
                .queryParam("base", 10)
                .queryParam("format", "plain")
                .queryParam("rnd", "new")
                .toUriString();
        try {
            String response = restTemplate.getForObject(url, String.class);
            if (response == null || response.isBlank()) {
                log.warn("Outside-check call to {} returned an empty body", url);
                return null;
            }
            return Integer.parseInt(response.trim());
        } catch (RestClientException | NumberFormatException ex) {
            log.warn("Outside-check call to {} failed: {}", url, ex.getMessage());
            return null;
        }
    }
}
