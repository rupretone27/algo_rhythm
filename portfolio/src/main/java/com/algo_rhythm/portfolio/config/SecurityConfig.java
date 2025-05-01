package com.algo_rhythm.portfolio.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig
{
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception
    {
        http
                .authorizeHttpRequests(auth -> auth.requestMatchers("/", "/home", "/index.html", "/static/**").permitAll().anyRequest().authenticated())
                .oauth2Login(oauth -> oauth.defaultSuccessUrl("/home", true))
                .logout(logout -> logout.logoutUrl("/logout").logoutSuccessUrl("/home").invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID").permitAll());

        return http.build();
    }
}
