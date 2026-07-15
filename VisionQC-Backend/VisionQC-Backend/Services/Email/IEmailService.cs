namespace fyp.Services
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail, string webResetLink);
    }
}
