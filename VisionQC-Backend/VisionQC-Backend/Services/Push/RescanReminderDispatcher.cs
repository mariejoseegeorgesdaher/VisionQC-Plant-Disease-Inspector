using fyp.Models;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace fyp.Services
{
    public class RescanReminderDispatcher : BackgroundService
    {   
        // So every 1 minute, it checks for reminders
        private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<RescanReminderDispatcher> _logger;

        public RescanReminderDispatcher(IServiceProvider serviceProvider, ILogger<RescanReminderDispatcher> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }
        //It runs forever while the backend is alive
        //ExecuteAsync verify DispatchDueRemindersAsync every one minute
        //DispatchDueRemindersAsync actually check the due date and invoke SendReminderAsync send the notifications
        //We split them because its cleaner because they have different responsibilities
            //ExecuteAsync = scheduling/repeating logic
            // DispatchDueRemindersAsync = reminder sending logic
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await DispatchDueRemindersAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed while dispatching re-scan reminders.");
                }

                await Task.Delay(PollInterval, stoppingToken);
            }
        }

        //Finds Due Reminders
        private async Task DispatchDueRemindersAsync(CancellationToken cancellationToken)
        {
            //creating a scope 
            using var scope = _serviceProvider.CreateScope();
            //save the db in this scope
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            //giving the scope access to IWebPushService so it could run SendReminderAsync
            var webPushService = scope.ServiceProvider.GetRequiredService<IWebPushService>();
            var now = DateTime.UtcNow;

            //Fetch this user reminders
            var reminders = await db.RescanReminders
                .Include(r => r.Scan)
                .Where(r => r.IsEnabled && r.SentAt == null && r.DueAt <= now)
                .OrderBy(r => r.DueAt)
                .ToListAsync(cancellationToken);

            foreach (var reminder in reminders)
            {
                //This finds all active browsers/devices for that use
                var subscriptions = await db.PushSubscriptions
                    .Where(s => s.UserId == reminder.UserId && s.IsActive)
                    .ToListAsync(cancellationToken);

                if (subscriptions.Count == 0)
                {
                    continue;
                }

                var delivered = false;
                string? lastError = null;

                foreach (var subscription in subscriptions)
                {
                    try
                    {
                        //This method that actually send the notifications
                        await webPushService.SendReminderAsync(subscription, reminder, cancellationToken);
                        subscription.LastSuccessfulPushAt = now;
                        subscription.UpdatedAt = now;
                        delivered = true;
                    }
                    catch (WebPushException ex) when ((int?)ex.StatusCode is 404 or 410)
                    {
                        subscription.IsActive = false;
                        subscription.UpdatedAt = now;
                        lastError = ex.Message;
                    }
                    catch (Exception ex)
                    {
                        lastError = ex.Message;
                        _logger.LogWarning(ex, "Failed to send push reminder for scan {ScanId} to subscription {SubscriptionId}.", reminder.ScanId, subscription.Id);
                    }
                }

                if (delivered)
                {
                    reminder.SentAt = now;
                    reminder.LastError = null;
                }
                else if (!string.IsNullOrWhiteSpace(lastError))
                {
                    reminder.LastError = lastError;
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
