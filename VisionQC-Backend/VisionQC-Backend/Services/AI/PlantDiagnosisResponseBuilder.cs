using fyp.DTOs;

namespace fyp.Services
{
    public class PlantDiagnosisResponseBuilder : IPlantDiagnosisResponseBuilder
    {
        public AiDiagnoseResponseDto Build(AiDiagnoseResponseDto? rawResult, string alias, string? location)
        {
            var result = rawResult ?? new AiDiagnoseResponseDto();
            var disease = string.IsNullOrWhiteSpace(result.Disease) ? "Unknown" : result.Disease.Trim();
            var normalizedLocation = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
            var severityLevel = ResolveSeverityLevel(disease, result.Confidence, result.SeverityLevel);
            var isHealthy = IsHealthyDiagnosis(disease);

            return new AiDiagnoseResponseDto
            {
                Disease = disease,
                Confidence = result.Confidence,
                SeverityLevel = severityLevel,
                Provider = string.IsNullOrWhiteSpace(result.Provider) ? "visionqc-ai-pipeline" : result.Provider.Trim(),
                Model = string.IsNullOrWhiteSpace(result.Model) ? "plant-diagnosis-v1" : result.Model.Trim(),
                Analysis = BuildAnalysis(result.Analysis, alias, normalizedLocation, disease, severityLevel),
                Solution = BuildSolution(result.Solution, disease, severityLevel),
                RecommendedProducts = result.RecommendedProducts.Count > 0
                    ? result.RecommendedProducts
                    : BuildRecommendedProducts(disease),
                CareSteps = result.CareSteps.Count > 0
                    ? result.CareSteps
                    : BuildCareSteps(disease, severityLevel),
                Prevention = string.IsNullOrWhiteSpace(result.Prevention)
                    ? BuildPrevention(disease, isHealthy)
                    : result.Prevention.Trim(),
                RescanRecommended = !isHealthy,
                RescanDays = ResolveRescanDays(result.RescanDays, disease, severityLevel),
                RescanReason = string.IsNullOrWhiteSpace(result.RescanReason)
                    ? BuildRescanReason(disease, severityLevel, isHealthy)
                    : result.RescanReason.Trim(),
            };
        }

        private static string BuildAnalysis(string? existingAnalysis, string alias, string? location, string disease, string severityLevel)
        {
            if (!string.IsNullOrWhiteSpace(existingAnalysis))
            {
                return existingAnalysis.Trim();
            }

            var locationFragment = string.IsNullOrWhiteSpace(location)
                ? ""
                : $" captured at {location}";

            if (IsHealthyDiagnosis(disease))
            {
                return $"{alias} appears healthy{locationFragment}. No visible disease pattern was identified in this scan.";
            }

            return $"{alias} shows visual patterns consistent with {disease}{locationFragment}. The current severity is assessed as {severityLevel?.ToLowerInvariant() ?? "unknown"} based on the available diagnosis output.";
        }

        private static string BuildSolution(string? existingSolution, string disease, string severityLevel)
        {
            if (!string.IsNullOrWhiteSpace(existingSolution))
            {
                return existingSolution.Trim();
            }

            if (IsHealthyDiagnosis(disease))
            {
                return "Continue routine monitoring, keep foliage dry when possible, and rescan if new symptoms appear.";
            }

            if (string.Equals(severityLevel, "Severe", StringComparison.OrdinalIgnoreCase))
            {
                return "Isolate the affected plant, remove badly damaged material, and begin targeted treatment as soon as possible.";
            }

            if (string.Equals(severityLevel, "Moderate", StringComparison.OrdinalIgnoreCase))
            {
                return "Remove affected leaves, improve airflow, and begin treatment while monitoring the plant closely over the next few days.";
            }

            return "Monitor the affected area, improve growing conditions, and apply an appropriate treatment if symptoms continue to spread.";
        }

        private static List<string> BuildRecommendedProducts(string disease)
        {
            if (IsHealthyDiagnosis(disease))
            {
                return new List<string>();
            }

            if (disease.Contains("mildew", StringComparison.OrdinalIgnoreCase) ||
                disease.Contains("rust", StringComparison.OrdinalIgnoreCase) ||
                disease.Contains("blight", StringComparison.OrdinalIgnoreCase))
            {
                return new List<string> { "Copper fungicide" };
            }

            return new List<string> { "Plant-safe disease treatment appropriate for the diagnosed condition" };
        }

        private static List<string> BuildCareSteps(string disease, string severityLevel)
        {
            if (IsHealthyDiagnosis(disease))
            {
                return new List<string>
                {
                    "Keep regular watering and light conditions stable",
                    "Inspect leaves periodically for new changes"
                };
            }

            var steps = new List<string>
            {
                "Remove visibly affected leaves or areas when safe to do so",
                "Improve airflow around the plant",
                "Avoid overhead watering until symptoms are under control"
            };

            if (string.Equals(severityLevel, "Severe", StringComparison.OrdinalIgnoreCase))
            {
                steps.Insert(0, "Separate the plant from healthy plants to limit spread");
            }

            return steps;
        }

        private static string BuildPrevention(string disease, bool isHealthy)
        {
            if (isHealthy)
            {
                return "Maintain balanced watering, good airflow, and regular monitoring to catch issues early.";
            }

            return $"Reduce excess moisture, improve airflow, and continue monitoring for recurring {disease.ToLowerInvariant()} symptoms.";
        }

        private static int ResolveRescanDays(int existingValue, string disease, string severityLevel)
        {
            if (existingValue > 0)
            {
                return existingValue;
            }

            if (IsHealthyDiagnosis(disease))
            {
                return 0;
            }

            if (string.Equals(severityLevel, "Severe", StringComparison.OrdinalIgnoreCase))
            {
                return 3;
            }

            if (string.Equals(severityLevel, "Moderate", StringComparison.OrdinalIgnoreCase))
            {
                return 7;
            }

            return 10;
        }

        private static string BuildRescanReason(string disease, string severityLevel, bool isHealthy)
        {
            if (isHealthy)
            {
                return "";
            }

            if (string.Equals(severityLevel, "Severe", StringComparison.OrdinalIgnoreCase))
            {
                return $"A quick follow-up scan is recommended to check whether {disease.ToLowerInvariant()} symptoms are worsening after immediate treatment.";
            }

            return $"A follow-up scan is recommended to monitor recovery and confirm whether the {disease.ToLowerInvariant()} symptoms are improving.";
        }

        private static string ResolveSeverityLevel(string disease, double confidence, string? existingSeverity)
        {
            if (!string.IsNullOrWhiteSpace(existingSeverity))
            {
                return existingSeverity.Trim();
            }

            if (IsHealthyDiagnosis(disease))
            {
                return "Low";
            }

            if (confidence >= 0.9)
            {
                return "Severe";
            }

            if (confidence >= 0.7)
            {
                return "Moderate";
            }

            return "Mild";
        }

        private static bool IsHealthyDiagnosis(string disease)
        {
            var normalizedDisease = (disease ?? string.Empty).Trim().ToLowerInvariant();

            if (normalizedDisease.Contains("no plant"))
            {
                return false;
            }

            return normalizedDisease == "healthy" ||
                   normalizedDisease == "healthy plant" ||
                   normalizedDisease == "no disease" ||
                   normalizedDisease == "none" ||
                   normalizedDisease.Contains("healthy") ||
                   normalizedDisease.Contains("no disease detected") ||
                   normalizedDisease.Contains("no obvious disease detected");
        }
    }
}
