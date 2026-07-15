using System.Net.Http.Headers;
using System.Text.Json;
using fyp.DTOs;

namespace fyp.Services
{
    public class PlantAiService : IPlantAiService
    {
        private readonly HttpClient _httpClient;

        public PlantAiService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<AiDiagnoseResponseDto> DiagnoseAsync(
            Stream imageStream,
            string fileName,
            string contentType,
            string alias,
            string? location,
            IEnumerable<AiPastScanSummaryDto>? pastScans = null,
            CancellationToken cancellationToken = default)
        {   
            //its not a normal json because it contains a file , it will be sent in this form
                //<form enctype="multipart/form-data">
                //   <input type="file" name="image" />
                //   <input type="text" name="alias" />
                //   <input type="text" name="location" />
                //</form>
            using var form = new MultipartFormDataContent();

            //This wraps the image stream into HTTP content , so it can be send in a request
            var imageContent = new StreamContent(imageStream);
            //tells the AI service what type of file it is
            imageContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);

            //add image to the form
            form.Add(imageContent, "image", fileName);

            //add alias to the form
            form.Add(new StringContent(alias), "alias");

            //add the location to the form
            if (!string.IsNullOrEmpty(location))
                form.Add(new StringContent(location), "location");
            
            //If previous scans exist, it serializes them into JSON and send them
            var pastScanList = pastScans?.ToList() ?? new List<AiPastScanSummaryDto>();
            if (pastScanList.Count > 0)
            {
                form.Add(new StringContent(JsonSerializer.Serialize(pastScanList)), "pastScans");
            }

            //call the ai api
            var response = await _httpClient.PostAsync("/diagnose", form, cancellationToken);

            //return a human readable eroor instead of statuses
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception(BuildFriendlyErrorMessage(error));
            }
            //get the ai response If the AI succeeds
            var json = await response.Content.ReadAsStringAsync();

            //convert into a dto 
            var result = JsonSerializer.Deserialize<AiDiagnoseResponseDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            //If the result cannot be parsed
            if (result == null)
                throw new Exception("Invalid AI response");

            return result;
        }

        private static string BuildFriendlyErrorMessage(string rawError)
        {
            if (string.IsNullOrWhiteSpace(rawError))
                return "The AI service is unavailable right now. Please try again.";

            try
            {
                using var document = JsonDocument.Parse(rawError);
                var root = document.RootElement;

                if (root.TryGetProperty("detail", out var detail))
                {
                    if (detail.ValueKind == JsonValueKind.String)
                    {
                        var detailText = detail.GetString();
                        if (!string.IsNullOrWhiteSpace(detailText))
                            return detailText;
                    }

                    var statusCode = TryReadInt(detail, "status_code");
                    var message = TryReadNestedString(detail, "error", "error", "message");
                    var status = TryReadNestedString(detail, "error", "error", "status");

                    if (statusCode == 429 || string.Equals(status, "RESOURCE_EXHAUSTED", StringComparison.OrdinalIgnoreCase))
                    {
                        return "The AI service is getting too many requests right now. Please wait a minute and try the scan again.";
                    }

                    if (statusCode == 503 || string.Equals(status, "UNAVAILABLE", StringComparison.OrdinalIgnoreCase))
                    {
                        return "The AI service is temporarily busy. Please wait a moment and try the scan again.";
                    }

                    if (statusCode == 401 || statusCode == 403 || string.Equals(status, "PERMISSION_DENIED", StringComparison.OrdinalIgnoreCase))
                    {
                        return "The AI diagnosis service could not authenticate your request right now. Please check the AI pipeline configuration and try again.";
                    }

                    if (statusCode == 404)
                    {
                        return "The selected AI model could not be found. Please verify the configured model name and try again.";
                    }

                    if (statusCode >= 500)
                    {
                        return "The AI provider had a temporary problem while analyzing this image. Please try the scan again in a moment.";
                    }

                    if (!string.IsNullOrWhiteSpace(message))
                    {
                        return $"The AI service could not complete the diagnosis. {message}";
                    }
                }
            }
            catch
            {
                // Fall through to the generic message below.
            }

            return "The AI service could not analyze this image right now. Please try again.";
        }

        private static int? TryReadInt(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var property))
                return null;

            if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number))
                return number;

            return null;
        }

        private static string? TryReadNestedString(JsonElement element, params string[] path)
        {
            var current = element;

            foreach (var segment in path)
            {
                if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
                    return null;
            }

            return current.ValueKind == JsonValueKind.String ? current.GetString() : null;
        }
    }
}
