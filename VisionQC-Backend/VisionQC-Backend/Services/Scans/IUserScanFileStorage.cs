using Microsoft.AspNetCore.Http;

namespace fyp.Services
{
    public interface IUserScanFileStorage
    {
        Task<StoredScanFile> SaveAsync(IFormFile image, CancellationToken cancellationToken = default);
        void Delete(string absolutePath);
    }

    public class StoredScanFile
    {
        public string FileName { get; set; } = "";
        public string AbsolutePath { get; set; } = "";
        public string RelativePath { get; set; } = "";
        public string ContentType { get; set; } = "application/octet-stream";
    }
}
