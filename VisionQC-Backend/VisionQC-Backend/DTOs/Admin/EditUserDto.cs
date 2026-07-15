using System.Text.Json.Serialization;

public class EditUserDto
{
    [JsonPropertyName("fullName")]
    public string? FullName { get; set; }

    [JsonPropertyName("newPassword")]
    public string? NewPassword { get; set; }
}