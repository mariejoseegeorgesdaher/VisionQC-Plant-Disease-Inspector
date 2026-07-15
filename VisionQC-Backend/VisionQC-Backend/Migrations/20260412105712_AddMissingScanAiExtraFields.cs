using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace fyp.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingScanAiExtraFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecommendedProducts",
                table: "Scans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CareSteps",
                table: "Scans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Prevention",
                table: "Scans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RescanRecommended",
                table: "Scans",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RescanDays",
                table: "Scans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RescanReason",
                table: "Scans",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecommendedProducts",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "CareSteps",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "Prevention",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "RescanRecommended",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "RescanDays",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "RescanReason",
                table: "Scans");
        }
    }
}
