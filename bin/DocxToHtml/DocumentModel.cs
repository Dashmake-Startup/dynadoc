using System.IO;

public class DocumentModel
{
    // Replicates the 'as const' string dictionary layout structurally
    public static class AssetType
    {
        public const string IMG = "img";
        public const string VIDEO = "video";
        public const string DOC = "doc";
        public const string AUDIO = "audio";
        public const string CODE = "code";
        public const string SLIDE = "slide";
        public const string SHEET = "sheet";
        public const string CHART = "chart";
        public const string DESIGN = "design";
        public const string LATEX = "latex";
        public const string SURVEY = "survey";
        public const string OTHER = "other";
    }

    /// <summary>
    /// Replicates the getAssetRelativePath JavaScript execution pattern safely in C#.
    /// </summary>
    public static string GetAssetRelativePath(string type, string fileName = "")
    {
        // Path.Combine automatically resolves platform-specific slashes (\ for Windows, / for Linux/macOS)
        return Path.Combine("assets", type, fileName);
    }
}