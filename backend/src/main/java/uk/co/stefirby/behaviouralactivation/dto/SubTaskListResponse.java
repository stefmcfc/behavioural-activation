package uk.co.stefirby.behaviouralactivation.dto;

import java.util.List;

public record SubTaskListResponse(List<SubTaskResponse> data, int count) {
}
