using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace fyp.Migrations
{
    /// <inheritdoc />
    public partial class AddAiFieldsToScans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Scans_Diseases_DiseaseId",
                table: "Scans");

            migrationBuilder.DropForeignKey(
                name: "FK_Scans_PlantTypes_PlantTypeId",
                table: "Scans");

            migrationBuilder.DropIndex(
                name: "IX_Scans_DiseaseId",
                table: "Scans");

            migrationBuilder.DropIndex(
                name: "IX_Scans_PlantTypeId",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "DiseaseId",
                table: "Scans");

            migrationBuilder.DropColumn(
                name: "PlantTypeId",
                table: "Scans");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Scans",
                newName: "ScannedAt");

            migrationBuilder.AlterColumn<string>(
                name: "Solution",
                table: "Scans",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "PlantAlias",
                table: "Scans",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "Scans",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "ImagePath",
                table: "Scans",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Analysis",
                table: "Scans",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Disease",
                table: "Scans",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Disease",
                table: "Scans");

            migrationBuilder.RenameColumn(
                name: "ScannedAt",
                table: "Scans",
                newName: "CreatedAt");

            migrationBuilder.AlterColumn<string>(
                name: "Solution",
                table: "Scans",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "PlantAlias",
                table: "Scans",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(80)",
                oldMaxLength: 80);

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "Scans",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ImagePath",
                table: "Scans",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.AlterColumn<string>(
                name: "Analysis",
                table: "Scans",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DiseaseId",
                table: "Scans",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PlantTypeId",
                table: "Scans",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Scans_DiseaseId",
                table: "Scans",
                column: "DiseaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Scans_PlantTypeId",
                table: "Scans",
                column: "PlantTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Scans_Diseases_DiseaseId",
                table: "Scans",
                column: "DiseaseId",
                principalTable: "Diseases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Scans_PlantTypes_PlantTypeId",
                table: "Scans",
                column: "PlantTypeId",
                principalTable: "PlantTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
