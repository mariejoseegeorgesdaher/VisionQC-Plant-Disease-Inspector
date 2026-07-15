using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace fyp.DTOs
{
    public class ChangeRoleDto
    {
        [Required][JsonPropertyName("role")]
        public string Role { get; set; } = "Regular"; // "Regular" or "Admin" }
    }
}