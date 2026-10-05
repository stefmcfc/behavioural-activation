package uk.co.stefirby.behaviouralactivation.dto;

import java.util.List;

public record WorkDayListResponse(List<WorkDayResponse> data, int count) {
}
