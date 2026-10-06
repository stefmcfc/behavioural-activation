import org.springframework.boot.gradle.tasks.run.BootRun

plugins {
	java
	groovy
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "uk.co.stefirby"
version = "0.39.2"
description = "Behavioural Activation Planner backend"

// Centralized here (kotlin:S6624) rather than inline in the dependencies block below --
// single place to bump each.
val groovyVersion = "5.1.1"
val spockVersion = "2.4-groovy-5.0"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")

	// Dev-only: automatic context restart on classpath changes (fast, in-process -- not a
	// full JVM/Gradle-daemon relaunch). `developmentOnly` is excluded from the built jar by
	// Spring Boot's Gradle plugin automatically, so this never ships. Pair with
	// `gradlew.bat bootRun --continuous` (RUNBOOK.md) -- Gradle watches source files and
	// recompiles, which this then detects and restarts against.
	developmentOnly("org.springframework.boot:spring-boot-devtools")

	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.apache.groovy:groovy:$groovyVersion")
	testImplementation("org.spockframework:spock-core:$spockVersion")
	testImplementation("org.spockframework:spock-spring:$spockVersion")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// --debug-jvm's own default is suspend=true, which blocks the forked JVM (and so Spring
// Boot's own startup) until a debugger attaches -- fine at an IDE ready to attach
// immediately, but it means scripts/start-dev.sh's health-check-then-report-ready flow
// would always time out waiting for a port that never opens. Forcing suspend=false makes
// `gradlew.bat bootRun --debug-jvm` start immediately either way -- the JDWP port (5005)
// stays open for a debugger to attach at any later point, it just never blocks getting there.
tasks.named<BootRun>("bootRun") {
	debugOptions {
		port.set(5005)
		server.set(true)
		suspend.set(false)
	}
}
