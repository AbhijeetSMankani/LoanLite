package com.loanlite.loanlite.services;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Deserialization target for https://api.provable.io/api/ints - only `outcome` (the generated
// random integers) is used by OutsideCheckService; the rest of the response (serverHash, nonce,
// permalink, ...) is provable-fairness verification metadata this feature doesn't need.
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProvableIntsResponse {

    private List<Integer> outcome;

    public List<Integer> getOutcome() {
        return outcome;
    }

    public void setOutcome(List<Integer> outcome) {
        this.outcome = outcome;
    }
}
