using System.Text;
using fyp.Models;
using fyp.Services;
using fyp.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// Program.cs is the startup file of the backend, ya3ne
//Backend starts.
//Program.cs runs.
//Program.cs creates/configures the middleware pipeline.
//the pipeline is the 



//It contains settings for: 
    // what services are available
    // how the database connects
    // how authentication works
    // what middleware runs
    // which controllers become API routes
    // what URL/port the backend listens on

//This creates the object used to configure the backend before it starts
var builder = WebApplication.CreateBuilder(args);

//what port to listen on
//0.0.0.0 means other devices on the same network may be able to reach it, not only my laptop
builder.WebHost.UseUrls(
    "https://0.0.0.0:7125",
    "https://localhost:7125",
    "http://0.0.0.0:7126",
    "http://localhost:7126");

// Enable Controllers , so they will become API endpoints
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("VisionQcFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://10.0.2.2:3000",
                "http://192.168.1.101:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

//db configuration and connection
// ApplicationDbContext represents your database in C#, UseNpgsql means PostgreSQL is used , "DefaultConnection" comes from appsettings.json
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

//Load Settings From appsettings.json and saving them as like global variables because its re-used in the whole project not just programs.cs
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));
builder.Services.Configure<WebPushSettings>(builder.Configuration.GetSection("WebPush"));
builder.Services.Configure<AiPipelineSettings>(builder.Configuration.GetSection("AiPipeline"));
//If some class asks for IEmailService interface, give it an instance of SmtpEmailService class
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddHttpClient<IPlantAiService, PlantAiService>(client =>
{
    var baseUrl =
    //setting the url base gotten from the appSettings, if null use http://127.0.0.1:8000
        builder.Configuration["AiPipeline:BaseUrl"] ?? "http://127.0.0.1:8000";
    client.BaseAddress = new Uri(baseUrl);
    // Scan diagnosis may wait on local model inference plus Ollama explanation generation.
    client.Timeout = TimeSpan.FromSeconds(300);
});
//If some class asks for the interface, give it an instance of the class
//These are services
builder.Services.AddScoped<IUserScanFileStorage, UserScanFileStorage>();
builder.Services.AddScoped<IPlantDiagnosisKnowledgeService, PlantDiagnosisKnowledgeService>();
builder.Services.AddScoped<IPlantDiagnosisResponseBuilder, PlantDiagnosisResponseBuilder>();
builder.Services.AddScoped<IUserScanOrchestrator, UserScanOrchestrator>();
builder.Services.AddSingleton<IWebPushService, WebPushService>();
//When the backend starts, also start this background service
builder.Services.AddHostedService<RescanReminderDispatcher>();

// Configure JWT authentication and token validation rules
//JwtBearerDefaults means The default authentication type is JWT Bearer token
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    //AddJwtBearer means add Bearer word to the JWT
    .AddJwtBearer(options =>
    {
        //VERIFY THE jwt in this way, if all of them passes , user authenticated for that request
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? string.Empty))
        };
    });

//swagger settings
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

//checks the JWT using the configuration of AddAuthentication()
builder.Services.AddAuthorization();
var app = builder.Build();



// `UseSwagger()` creates Swagger API documentation.
app.UseSwagger();
// `UseSwaggerUI()` shows the Swagger testing page.
app.UseSwaggerUI();

// `UseHttpsRedirection()` redirects HTTP requests to HTTPS.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// `UseStaticFiles()` serves public files from `wwwroot`.
app.UseStaticFiles();
app.UseCors("VisionQcFrontend");
// `UseAuthentication()` checks the JWT and identifies the user.
app.UseAuthentication();
// `UseAuthorization()` checks if the user is allowed to access the endpoint.
app.UseAuthorization();

// `MapControllers()` routes API requests to the correct controller action.
app.MapControllers();

//run the app
app.Run();
