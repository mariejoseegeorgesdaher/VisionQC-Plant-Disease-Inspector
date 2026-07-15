using fyp.DTOs;

namespace fyp.Services
{
    public interface IPlantDiagnosisResponseBuilder
    {
        AiDiagnoseResponseDto Build(AiDiagnoseResponseDto? rawResult, string alias, string? location);
    }
}
