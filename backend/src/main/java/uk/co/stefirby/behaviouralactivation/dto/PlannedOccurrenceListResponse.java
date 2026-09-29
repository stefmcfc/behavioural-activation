package uk.co.stefirby.behaviouralactivation.dto;

import java.util.List;

public record PlannedOccurrenceListResponse(List<PlannedOccurrenceResponse> data, int count) {
}
