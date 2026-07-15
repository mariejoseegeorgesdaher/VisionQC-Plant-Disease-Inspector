using Microsoft.EntityFrameworkCore;

namespace fyp.Models
{
    public class ApplicationDbContext : DbContext
    {
        //This file maps the tables of the db , their constrains and relations
        //ApplicationDbContext represents the database
        //DbContextOptions<ApplicationDbContext> options means use use postgresql with connection string (we did define it in programs.cs) 
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }
        //These are the tables
        public DbSet<User> Users { get; set; }
        public DbSet<PlantAlias> PlantAliases { get; set; }
        public DbSet<Disease> Diseases { get; set; }
        public DbSet<Scan> Scans { get; set; }
        public DbSet<PushSubscription> PushSubscriptions { get; set; }
        public DbSet<RescanReminder> RescanReminders { get; set; }

        //So modelBuilder.Entity is used to configure that the model cannot tell via properties only
            //relationships
            // foreign keys
            // unique constraints
            // indexes
            // delete behavior
            // special table rules
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            //This calls the original OnModelCreating method from the parent class DbContext
            base.OnModelCreating(modelBuilder);

            // modelBuilder.Entity<T>() means:
            // Configure the database table for model T

            //The same user cannot have two plants with the same alias/name
            modelBuilder.Entity<PlantAlias>()
                .HasIndex(p => new { p.UserId, p.Alias })
                .IsUnique();

            //One User has many PlantAliases, each PlantAlias belongs to one User
            //If the user is deleted, their plant aliases are deleted too
            modelBuilder.Entity<PlantAlias>()
                .HasOne(p => p.User)
                .WithMany(u => u.PlantAliases)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            //One PlantAlias can have many Scans, each Scan can be linked to one PlantAlias
            modelBuilder.Entity<Scan>()
                .HasOne(s => s.PlantAliasRecord)
                .WithMany(p => p.Scans)
                .HasForeignKey(s => s.PlantAliasId)
                //If the plant alias is deleted, keep the scan, but set PlantAliasId to null
                .OnDelete(DeleteBehavior.SetNull);

            //Disease names are stored once in Diseases, and scans reference them with DiseaseId
            modelBuilder.Entity<Disease>()
                .HasIndex(d => d.Name)
                .IsUnique();

            modelBuilder.Entity<Scan>()
                .HasOne(s => s.DiseaseRecord)
                .WithMany(d => d.Scans)
                .HasForeignKey(s => s.DiseaseId)
                .OnDelete(DeleteBehavior.SetNull);

            //The same push subscription endpoint cannot be saved twice
            modelBuilder.Entity<PushSubscription>()
                .HasIndex(s => s.Endpoint)
                .IsUnique();

            // One user can have many push subscriptions, maybe phone + browser
            modelBuilder.Entity<PushSubscription>()
                .HasOne(s => s.User)
                .WithMany(u => u.PushSubscriptions)
                .HasForeignKey(s => s.UserId)
                //If user is deleted, their push subscriptions are deleted
                .OnDelete(DeleteBehavior.Cascade);

            //Each scan can have only one rescan reminder
            modelBuilder.Entity<RescanReminder>()
                .HasIndex(r => r.ScanId)
                .IsUnique();

            // One user can have many reminders
            modelBuilder.Entity<RescanReminder>()
                .HasOne(r => r.User)
                .WithMany(u => u.RescanReminders)
                .HasForeignKey(r => r.UserId)
                //If user is deleted, reminders are deleted
                .OnDelete(DeleteBehavior.Cascade);

            // Each reminder belongs to one scan
            modelBuilder.Entity<RescanReminder>()
                .HasOne(r => r.Scan)
                .WithMany()
                .HasForeignKey(r => r.ScanId)
                //If the scan is deleted, its reminder is deleted too
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
