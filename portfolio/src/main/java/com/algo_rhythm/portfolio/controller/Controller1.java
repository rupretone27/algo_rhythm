package com.algo_rhythm.portfolio.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class Controller1
{
    @GetMapping("/user")
    public Map<String, String> user(@AuthenticationPrincipal OAuth2User principal)
    {
        return Map.of("name", principal.getAttribute("name"));
    }
}