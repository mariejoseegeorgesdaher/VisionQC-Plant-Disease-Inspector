using fyp.DTOs;

namespace fyp.Services
{
    public interface IUserScanOrchestrator
    {
        Task<ScanDetailsDto> CreateScanAsync(
            Guid userId,
            PlantScanDto dto,
            string publicBaseUrl,
            CancellationToken cancellationToken = default);
    }
}
