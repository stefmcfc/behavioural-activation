# Build stage: invokes the project's own checked-in Gradle wrapper (gradlew) directly, so the
# Gradle version always matches gradle/wrapper/gradle-wrapper.properties exactly -- no separate
# official Gradle image / version-matching step needed. See tooling_spec_006's Decision 1.
FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /workspace
COPY gradlew ./
COPY gradle ./gradle
COPY build.gradle.kts settings.gradle.kts ./
COPY src ./src
RUN chmod +x gradlew && ./gradlew build -x test --no-daemon

# Runtime stage: slim JRE, only the built jar copied across.
FROM eclipse-temurin:25-jre-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
EXPOSE 8420
ENTRYPOINT ["java", "-jar", "app.jar"]
