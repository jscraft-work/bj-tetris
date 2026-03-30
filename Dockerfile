FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY server/gradle/ gradle/
COPY server/gradlew server/build.gradle server/settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true

COPY server/src/ src/
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 9001

ENTRYPOINT ["java", "-jar", "app.jar"]
