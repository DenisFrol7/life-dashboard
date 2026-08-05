package com.lifedashboard;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class LifeDashboardApplicationTests {

    @Autowired
    private Environment environment;

    @Test
    void contextLoads() {
        assertTrue(Arrays.asList(environment.getActiveProfiles()).contains("test"));
    }
}
