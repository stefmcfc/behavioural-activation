package uk.co.stefirby.behaviouralactivation.dto;

import java.util.List;

public record ActivityListResponse(List<ActivityResponse> data, int count) {
}
