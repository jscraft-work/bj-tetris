package com.bjtetris.server;

import com.bjtetris.server.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class BjTetrisServerApplication {

  public static void main(String[] args) {
    SpringApplication.run(BjTetrisServerApplication.class, args);
  }
}
