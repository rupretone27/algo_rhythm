package com.algo_rhythm.portfolio.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class RedirectHomeController
{
    @GetMapping("/")
    public String Home()
    {
        return "redirect:/home";
    }
}