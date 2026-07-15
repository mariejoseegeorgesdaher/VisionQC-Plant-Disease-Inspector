using Microsoft.AspNetCore.Http;

namespace fyp.Services
{
    public class UserScanFileStorage : IUserScanFileStorage
    {
        // Gives access to wwwroot, where public uploaded files are stored.
        private readonly IWebHostEnvironment _env;

        public UserScanFileStorage(IWebHostEnvironment env)
        {
            _env = env;
        }

        // Keep the original extension and store files under wwwroot/uploads/scans.
        public async Task<StoredScanFile> SaveAsync(IFormFile image, CancellationToken cancellationToken = default)
        {

            //Gets the file extension from the original filename.
            var ext = Path.GetExtension(image.FileName).ToLowerInvariant();

            //Gets the wwwroot folder path
            var webRoot = _env.WebRootPath;

            //manually builds the path to wwwroot if webRoot empty
            if (string.IsNullOrWhiteSpace(webRoot))
            {
                webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            }

            //create folder if doesn't exist
            var uploadsDir = Path.Combine(webRoot, "uploads", "scans");
            Directory.CreateDirectory(uploadsDir);

            // Creates a unique filename 
            //This avoids two users uploading for example plant.jpg and overwriting each other.
            var storedFileName = $"{Guid.NewGuid()}{ext}";

            //Creates the full disk path
            var absolutePath = Path.Combine(uploadsDir, storedFileName);

            // Creates a file on disk and copies the uploaded image content into it
            await using (var fs = new FileStream(absolutePath, FileMode.Create))
            {
                await image.CopyToAsync(fs, cancellationToken);
            }

            // Return both disk path for backend use and relative URL path for clients
            return new StoredScanFile
            {
                FileName = storedFileName,
                AbsolutePath = absolutePath,
                RelativePath = $"/uploads/scans/{storedFileName}",
                ContentType = image.ContentType ?? "application/octet-stream"
            };
        }

        public void Delete(string absolutePath)
        {
            try
            {
                // Used to clean up the saved image if the scan pipeline fails later.
                if (File.Exists(absolutePath))
                {
                    File.Delete(absolutePath);
                }
            }
            catch
            {
                // Keep the original pipeline error as the primary failure.
            }
        }
    }
}
