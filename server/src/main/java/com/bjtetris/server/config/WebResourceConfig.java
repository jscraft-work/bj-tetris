package com.bjtetris.server.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebResourceConfig implements WebMvcConfigurer {

  @Override
  public void addViewControllers(ViewControllerRegistry registry) {
    registry.addViewController("/").setViewName("forward:/index.html");
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    String webRoot = resolveWebRoot();
    registry.addResourceHandler("/**").addResourceLocations(webRoot);
  }

  private String resolveWebRoot() {
    List<Path> candidates = List.of(Path.of("web"), Path.of("../web"));
    for (Path candidate : candidates) {
      if (Files.exists(candidate.resolve("index.html"))) {
        return candidate.toUri().toString();
      }
    }
    throw new IllegalStateException("web 디렉터리를 찾지 못했습니다.");
  }
}
