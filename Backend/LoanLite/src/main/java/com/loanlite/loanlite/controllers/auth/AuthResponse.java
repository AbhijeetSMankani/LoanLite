package com.loanlite.loanlite.controllers.auth;

public class AuthResponse {
    private String tokenType;
    private String token;

    public AuthResponse() {}

    public AuthResponse(String tokenType, String token) {
        this.tokenType = tokenType;
        this.token = token;
    }

    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
