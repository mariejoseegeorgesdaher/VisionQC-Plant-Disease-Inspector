using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace fyp.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeScanDiseases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StatisticsValues");

            migrationBuilder.AddColumn<Guid>(
                name: "DiseaseId",
                table: "Scans",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""CREATE EXTENSION IF NOT EXISTS "pgcrypto";""");

            migrationBuilder.Sql("""
                INSERT INTO "Diseases" ("Id", "Name")
                SELECT gen_random_uuid(), source."Name"
                FROM (
                    SELECT DISTINCT trim("Disease") AS "Name"
                    FROM "Scans"
                    WHERE "Disease" IS NOT NULL AND trim("Disease") <> ''
                ) AS source
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "Diseases" AS existing
                    WHERE lower(existing."Name") = lower(source."Name")
                );
                """);

            migrationBuilder.Sql("""
                UPDATE "Scans" AS scan
                SET "DiseaseId" = disease."Id"
                FROM "Diseases" AS disease
                WHERE scan."Disease" IS NOT NULL
                  AND trim(scan."Disease") <> ''
                  AND lower(disease."Name") = lower(trim(scan."Disease"));
                """);

            migrationBuilder.DropColumn(
                name: "Disease",
                table: "Scans");

            migrationBuilder.CreateIndex(
                name: "IX_Scans_DiseaseId",
                table: "Scans",
                column: "DiseaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseases_Name",
                table: "Diseases",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Scans_Diseases_DiseaseId",
                table: "Scans",
                column: "DiseaseId",
                principalTable: "Diseases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Scans_Diseases_DiseaseId",
                table: "Scans");

            migrationBuilder.DropIndex(
                name: "IX_Scans_DiseaseId",
                table: "Scans");

            migrationBuilder.DropIndex(
                name: "IX_Diseases_Name",
                table: "Diseases");

            migrationBuilder.AddColumn<string>(
                name: "Disease",
                table: "Scans",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Scans" AS scan
                SET "Disease" = disease."Name"
                FROM "Diseases" AS disease
                WHERE scan."DiseaseId" = disease."Id";
                """);

            migrationBuilder.DropColumn(
                name: "DiseaseId",
                table: "Scans");

            migrationBuilder.CreateTable(
                name: "StatisticsValues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SnapshotDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalActiveUsers = table.Column<int>(type: "integer", nullable: false),
                    TotalScans = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StatisticsValues", x => x.Id);
                });
        }
    }
}
