using fyp.DTOs;

namespace fyp.Services
{
    public interface IPlantAiService
    {
        Task<AiDiagnoseResponseDto> DiagnoseAsync(
            Stream imageStream,
            string fileName,
            string contentType,
            string alias,
            string? location,
            IEnumerable<AiPastScanSummaryDto>? pastScans = null,
            CancellationToken cancellationToken = default);
    }
}
