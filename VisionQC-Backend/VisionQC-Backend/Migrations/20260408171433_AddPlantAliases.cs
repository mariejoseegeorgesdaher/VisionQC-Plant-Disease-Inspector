using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace fyp.Migrations
{
    /// <inheritdoc />
    public partial class AddPlantAliases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PlantAliasId",
                table: "Scans",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlantAliases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Alias = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Location = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastScannedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlantAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlantAliases_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Scans_PlantAliasId",
                table: "Scans",
                column: "PlantAliasId");

            migrationBuilder.CreateIndex(
                name: "IX_PlantAliases_UserId_Alias",
                table: "PlantAliases",
                columns: new[] { "UserId", "Alias" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Scans_PlantAliases_PlantAliasId",
                table: "Scans",
                column: "PlantAliasId",
                principalTable: "PlantAliases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Scans_PlantAliases_PlantAliasId",
                table: "Scans");

            migrationBuilder.DropTable(
                name: "PlantAliases");

            migrationBuilder.DropIndex(
                name: "IX_Scans_PlantAliasId",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "PlantAliasId",
                table: "Scans");
        }
    }
}
