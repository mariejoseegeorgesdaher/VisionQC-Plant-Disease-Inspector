using fyp.DTOs;

namespace fyp.Services
{
    public interface IPlantDiagnosisKnowledgeService
    {
        Task<AiDiagnoseResponseDto> EnrichAsync(
            AiDiagnoseResponseDto diagnosis,
            string alias,
            string? location,
            CancellationToken cancellationToken = default);
    }
}
