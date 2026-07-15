using fyp.Settings;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;

namespace fyp.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly SmtpSettings _settings;

        //reads the smtp setting from appSettings
        public SmtpEmailService(IOptions<SmtpSettings> settings)
        {
            _settings = settings.Value;
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string webResetLink)
        {
            using var client = new SmtpClient(_settings.Host, _settings.Port)
            {
                //set the ssl (true or false)
                EnableSsl = _settings.EnableSsl,
                //set the user : NetworkCredential is a .NET class that holds username/password credentials for a network service
                Credentials = new NetworkCredential(_settings.Username, _settings.Password),
            };

            var subject = "Reset your VisionQC password";

            var htmlBody = $@"
                <p>You requested to reset your password.</p>
                <p>This link expires in <b>15 minutes</b>.</p>
                <p><a href=""{webResetLink}"">Click here to reset your password</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            ";

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.FromEmail, _settings.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };

            message.To.Add(toEmail);

            //SendMailAsync sends a network request/communication to Gmail’s SMTP server
            //and the server send the email message to Gmail SMTP
            await client.SendMailAsync(message);
        }
    }
}
