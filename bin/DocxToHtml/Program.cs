using System;
using System.IO;
using Clippit;
using Clippit.Word;

using System.Text;
using System.Xml.Linq;
using Clippit.Html;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

using System.Xml;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Globalization;


public class HtmlToWmlReadAsXElement
{

 public static XElement ReadAsXElement(FileInfo sourceHtmlFi)
{
    // 1. Load the raw content
    string htmlString = File.ReadAllText(sourceHtmlFi.FullName, Encoding.UTF8);
    
    // 2. Pre-process the content to ensure it meets XML/XHTML standards
    // XElement.Parse is strict; it fails on missing roots or unclosed tags.
    htmlString = EnsureFullHtml(htmlString);

    XElement html = null;

    try
    {
        // 3. Attempt standard XML parsing
        html = XElement.Parse(htmlString);
    }
#if USE_HTMLAGILITYPACK
    catch (XmlException)
    {
        // Fallback: If parsing fails, use HtmlAgilityPack to force-convert to valid XML
        var hdoc = new HtmlDocument();
        hdoc.OptionOutputAsXml = true;
        hdoc.LoadHtml(htmlString);
        
        using (var writer = new StringWriter())
        {
            hdoc.Save(writer);
            htmlString = writer.ToString();
        }
        
        // Clean entities that might have been mangled during transition
        htmlString = CleanHtmlEntities(htmlString);
        html = XElement.Parse(htmlString);
    }
#else
    catch (XmlException ex)
    {
        Console.WriteLine($"Critical XML Parse Error: {ex.Message}");
        throw; // Do not swallow the error if we don't have a fallback
    }
#endif

    // 4. Final step: Normalize namespaces so the converter doesn't choke
    if (html == null) throw new InvalidOperationException("Failed to parse HTML into XElement.");
    
    return (XElement)ConvertToNoNamespace(html);
}

// Helper to handle the character entity replacements cleanly
private static string CleanHtmlEntities(string input)
{
    var sb = new StringBuilder(input);
    sb.Replace("&amp;", "&");
    sb.Replace("&nbsp;", "\xA0");
    sb.Replace("&quot;", "\"");
    // Use temporary placeholders to avoid recursive replacements
    sb.Replace("&lt;", "~~LT~~");
    sb.Replace("&gt;", "~~GT~~");
    sb.Replace("&", "&amp;");
    sb.Replace("~~LT~~", "&lt;");
    sb.Replace("~~GT~~", "&gt;");
    return sb.ToString();
}

  public static XElement ReadAsXElement22(FileInfo sourceHtmlFi)
    {
        var htmlString = File.ReadAllText(sourceHtmlFi.FullName);
        XElement html = null;

        try
        {
            // Try direct XML parsing first
            html = XElement.Parse(htmlString);
        }
#if USE_HTMLAGILITYPACK
        catch (XmlException)
        {
            // Fallback to HtmlAgilityPack for malformed HTML
            var hdoc = new HtmlDocument();
            hdoc.Load(sourceHtmlFi.FullName, Encoding.UTF8);
            hdoc.OptionOutputAsXml = true;

            // Rebuild HTML as valid XML string
            using (var writer = new StringWriter())
            {
                hdoc.Save(writer);
                htmlString = writer.ToString();
            }

            // Fix common entity issues
            var sb = new StringBuilder(htmlString);
            sb.Replace("&amp;", "&");
            sb.Replace("&nbsp;", "\xA0");
            sb.Replace("&quot;", "\"");
            sb.Replace("&lt;", "~lt;");
            sb.Replace("&gt;", "~gt;");
            sb.Replace("&#", "~#");
            sb.Replace("&", "&amp;");
            sb.Replace("~lt;", "&lt;");
            sb.Replace("~gt;", "&gt;");
            sb.Replace("~#", "&#");

            html = XElement.Parse(sb.ToString());
        }
#else
        catch (XmlException ex)
        {
            // Try to wrap missing structure manually
            htmlString = EnsureFullHtml(htmlString);
            html = XElement.Parse(htmlString);
        }
#endif

        html = (XElement)ConvertToNoNamespace(html);
        return html;
    }

    private static string EnsureFullHtml(string htmlFragment)
    {
        // Add missing root structure if partial HTML
        if (!htmlFragment.Contains("<html", StringComparison.OrdinalIgnoreCase))
        {
            var sb = new StringBuilder();
            sb.AppendLine("<!DOCTYPE html>");
            sb.AppendLine("<html>");
            sb.AppendLine("<head><meta charset=\"utf-8\"/></head>");
            sb.AppendLine("<body>");
            sb.AppendLine(htmlFragment);
            sb.AppendLine("</body></html>");
            return sb.ToString();
        }
        return htmlFragment;
    }

  private static object ConvertToNoNamespace(XNode node)
  {
    var element = node as XElement;
    if (element != null)
    {
      return new XElement(
          element.Name.LocalName,
          element.Attributes().Where(a => !a.IsNamespaceDeclaration),
          element.Nodes().Select(n => ConvertToNoNamespace(n))
      );
    }
    return node;
  }
}
class DynadocConverterApp
{

  private static readonly Lazy<string> s_tempDir = new(() =>
          {
            var dir = new DirectoryInfo("./../../../../temp");
            if (dir.Exists)
              dir.Delete(true);
            dir.Create();
            return dir.FullName;
          });

  protected static string TempDir => s_tempDir.Value;

  // Usage in console
  // dotnet run -- "/path/to/file.docx" "/path/to/output/folder"
  // dotnet run -- "/path/to/file.pptx" "/path/to/output/folder"

static void Main(string[] args)
  {
    if (args.Length == 0)
    {
      Console.WriteLine("Usage: DynadocConverterApp <input.file> [output.folder]");
      return;
    }

    string inputFilePath = args[0];
    string outputPathArg = args[1];
    // string outputDir = args.Length > 1 ? args[1] : Path.ChangeExtension(inputFilePath, ".docx");

    if (!File.Exists(inputFilePath))
    {
      Console.WriteLine($"File not found: {inputFilePath}");
      return;
    }

    try
    {
      // string htmlContent = inputFilePath;
      // string htmlContent = File.ReadAllText(inputFilePath);

      var ext = Path.GetExtension(inputFilePath).ToLower();
      //  Console.WriteLine($"File : {ext},{inputFilePath} ,{outputPathArg}");

      // if inputFilePath file extension is html, Convert HTML to DOCX
      // Ex dotnet run -- "/path/to/Downloads/example.html" "/path/to/Downloads/"
      if (ext == ".html")
      {
                ConvertToDocx(inputFilePath, outputPathArg);
      }

      //  if inputFilePath file extension is docx, Convert DOCX to HTML
      // Ex dotnet run -- "/path/to/Downloads/example.docx" "/path/to/Downloads/"
      else if (ext == ".docx"){
              //  Console.WriteLine($"File docx : {ext},{inputFilePath} ,{outputPathArg}");

                ConvertToHtml(inputFilePath, outputPathArg);
      }

      // if inputFilePath file extension is pptx, Convert PPTX to Dynadoc presentation JSON
      else if (ext == ".pptx"){
        PptxToDynadocConverter.Convert(inputFilePath, outputPathArg);
      }
      // ConvertHtmlToDocx(htmlContent, outputDir);

      // Console.WriteLine($"Conversion successful: {outputDir}");
      // Console.WriteLine($"{outputDir}");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error: {ex.Message}");
    }
  }





  public static void ConvertToDocx(string file, string outputPathArg)
{
    var s_ProduceAnnotatedHtml = false;
    var sourceHtmlFi = new FileInfo(file);

    // 1. Load HTML and ensure it is not null
    var html = HtmlToWmlReadAsXElement.ReadAsXElement(sourceHtmlFi);
    if (html == null) throw new InvalidOperationException("HTML could not be parsed.");

    // 2. Safely extract CSS
    var styleElement = html.Descendants()
        .FirstOrDefault(d => d.Name.LocalName.ToLower() == "style");
    
    // Safely cast to string; if element is missing, use empty string
    string rawCss = styleElement != null ? (string)styleElement : string.Empty;
    var usedAuthorCss = HtmlToWmlConverter.CleanUpCss(rawCss);

    // 3. Resolve Output Path
    string resolvedOutputPath = Path.HasExtension(outputPathArg) 
        ? outputPathArg 
        : Path.Combine(outputPathArg, Path.ChangeExtension(sourceHtmlFi.Name, ".docx"));

    Directory.CreateDirectory(Path.GetDirectoryName(resolvedOutputPath)!);
    var destDocxFi = new FileInfo(resolvedOutputPath);

    // 4. Configure Conversion Settings
    var settings = HtmlToWmlConverter.GetDefaultSettings();
    settings.BaseUriForImages = sourceHtmlFi.DirectoryName;

    // 5. Run Conversion
    var annotatedHtmlFi = new FileInfo(
        Path.Combine(Path.GetTempPath(), sourceHtmlFi.Name.Replace(".html", "-Annotated.txt"))
    );

    var doc = HtmlToWmlConverter.ConvertHtmlToWml(
        defaultCss,
        usedAuthorCss,
        userCss,
        html,
        settings,
        null,
        s_ProduceAnnotatedHtml ? annotatedHtmlFi.FullName : null
    );

    doc.SaveAs(destDocxFi.FullName);

    // 6. Cleanup
    if (s_ProduceAnnotatedHtml && annotatedHtmlFi.Exists)
    {
        try { annotatedHtmlFi.Delete(); } catch { }
    }
}

  private sealed class CommentMeta
  {
    public string Id { get; init; } = string.Empty;
    public string Author { get; init; } = string.Empty;
    public string DateIso { get; init; } = string.Empty;
    public string Text { get; init; } = string.Empty;
    public string ThreadJson { get; init; } = "[]";
  }

  private static readonly XNamespace W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  private const string CommentStartMarkerPrefix = "[[DDOC_COMMENT_START|";
  private const string CommentEndMarkerPrefix = "[[DDOC_COMMENT_END|";

  private static Dictionary<string, CommentMeta> ExtractComments(WordprocessingDocument wDoc)
  {
    var commentsPart = wDoc.MainDocumentPart?.WordprocessingCommentsPart;
    if (commentsPart?.Comments == null)
      return new Dictionary<string, CommentMeta>();

    var map = new Dictionary<string, CommentMeta>();

    foreach (var comment in commentsPart.Comments.Elements<Comment>())
    {
      var id = comment.Id?.Value ?? string.Empty;
      if (string.IsNullOrWhiteSpace(id))
        continue;

      var author = comment.Author?.Value ?? string.Empty;
      var dateRaw = comment.Date?.InnerText ?? string.Empty;
      var dateIso = dateRaw;
      if (!string.IsNullOrWhiteSpace(dateRaw))
      {
        if (DateTime.TryParse(dateRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed) ||
            DateTime.TryParse(dateRaw, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out parsed))
        {
          dateIso = parsed.ToString("O", CultureInfo.InvariantCulture);
        }
      }
      var text = string.Concat(comment.Descendants<Text>().Select(t => t.Text));

      var threadPayload = new[]
      {
        new {
          id,
          author,
          date = dateIso,
          text
        }
      };

      var threadJson = JsonSerializer.Serialize(threadPayload);

      map[id] = new CommentMeta
      {
        Id = id,
        Author = author,
        DateIso = dateIso,
        Text = text,
        ThreadJson = threadJson
      };
    }

    return map;
  }

  private static string EncodeMarkerPayload(string value)
  {
    var bytes = Encoding.UTF8.GetBytes(value ?? string.Empty);
    return Convert.ToBase64String(bytes);
  }

  private static string DecodeMarkerPayload(string value)
  {
    if (string.IsNullOrWhiteSpace(value)) return string.Empty;
    try
    {
      var bytes = Convert.FromBase64String(value);
      return Encoding.UTF8.GetString(bytes);
    }
    catch
    {
      return value;
    }
  }

  private static XElement CreateMarkerRun(string markerText)
  {
    return new XElement(
      W + "r",
      new XElement(
        W + "t",
        new XAttribute(XNamespace.Xml + "space", "preserve"),
        markerText
      )
    );
  }

  private static void InjectCommentMarkers(WordprocessingDocument wDoc, Dictionary<string, CommentMeta> comments)
  {
    var mainPart = wDoc.MainDocumentPart;
    if (mainPart == null) return;

    var xDoc = mainPart.GetXDocument();
    var body = xDoc.Root?.Element(W + "body");
    if (body == null) return;

    var active = new List<string>();

    foreach (var paragraph in body.Descendants(W + "p").ToList())
    {
      if (active.Count > 0)
      {
        for (var i = active.Count - 1; i >= 0; i--)
        {
          var id = active[i];
          var meta = comments.TryGetValue(id, out var found) ? found : new CommentMeta { Id = id };
          var marker = $"{CommentStartMarkerPrefix}{meta.Id}|{EncodeMarkerPayload(meta.Author)}|{EncodeMarkerPayload(meta.ThreadJson)}]]";
          paragraph.AddFirst(CreateMarkerRun(marker));
        }
      }

      var children = paragraph.Elements().ToList();
      foreach (var child in children)
      {
        if (child.Name == W + "commentRangeStart")
        {
          var id = child.Attribute(W + "id")?.Value ?? string.Empty;
          if (!string.IsNullOrWhiteSpace(id))
          {
            if (!active.Contains(id)) active.Add(id);
            var meta = comments.TryGetValue(id, out var found) ? found : new CommentMeta { Id = id };
            var marker = $"{CommentStartMarkerPrefix}{meta.Id}|{EncodeMarkerPayload(meta.Author)}|{EncodeMarkerPayload(meta.ThreadJson)}]]";
            child.AddBeforeSelf(CreateMarkerRun(marker));
          }
          child.Remove();
          continue;
        }

        if (child.Name == W + "commentRangeEnd")
        {
          var id = child.Attribute(W + "id")?.Value ?? string.Empty;
          if (!string.IsNullOrWhiteSpace(id))
          {
            var marker = $"{CommentEndMarkerPrefix}{id}]]";
            child.AddBeforeSelf(CreateMarkerRun(marker));
            active.Remove(id);
          }
          child.Remove();
          continue;
        }
      }

      foreach (var commentRef in paragraph.Descendants(W + "commentReference").ToList())
      {
        var parentRun = commentRef.Parent;
        commentRef.Remove();
        if (parentRun != null && !parentRun.Elements().Any())
        {
          parentRun.Remove();
        }
      }

      if (active.Count > 0)
      {
        for (var i = active.Count - 1; i >= 0; i--)
        {
          var id = active[i];
          var marker = $"{CommentEndMarkerPrefix}{id}]]";
          paragraph.Add(CreateMarkerRun(marker));
        }
      }
    }

    mainPart.PutXDocument();
  }

  private static string ReplaceCommentMarkers(string html)
  {
    if (string.IsNullOrEmpty(html)) return html;

    html = Regex.Replace(
      html,
      @"\[\[DDOC_COMMENT_START\|([^\|]+)\|([^\|]*)\|([^\]]*)\]\]",
      match =>
      {
        var id = match.Groups[1].Value;
        var author = DecodeMarkerPayload(match.Groups[2].Value);
        var threadJson = DecodeMarkerPayload(match.Groups[3].Value);
        var safeId = WebUtility.HtmlEncode(id);
        var safeAuthor = WebUtility.HtmlEncode(author);
        var safeThread = WebUtility.HtmlEncode(threadJson);
        return $"<span data-word-comment-id=\"{safeId}\" data-word-comment-author=\"{safeAuthor}\" data-word-comment-thread=\"{safeThread}\">";
      },
      RegexOptions.Compiled
    );

    html = Regex.Replace(
      html,
      @"\[\[DDOC_COMMENT_END\|([^\]]+)\]\]",
      "</span>",
      RegexOptions.Compiled
    );

    return html;
  }

  private static readonly string defaultCss =
      @"html, address,
blockquote,
body, dd, div,
dl, dt, fieldset, form,
frame, frameset,
h1, h2, h3, h4,
h5, h6, noframes,
ol, p, ul, center,
dir, hr, menu, pre { display: block; unicode-bidi: embed }
li { display: list-item }
head { display: none }
table { display: table }
tr { display: table-row }
thead { display: table-header-group }
tbody { display: table-row-group }
tfoot { display: table-footer-group }
col { display: table-column }
colgroup { display: table-column-group }
td, th { display: table-cell }
caption { display: table-caption }
th { font-weight: bolder; text-align: center }
caption { text-align: center }
body { margin: auto; }
h1 { font-size: 2em; margin: auto; }
h2 { font-size: 1.5em; margin: auto; }
h3 { font-size: 1.17em; margin: auto; }
h4, p,
blockquote, ul,
fieldset, form,
ol, dl, dir,
menu { margin: auto }
a { color: blue; }
h5 { font-size: .83em; margin: auto }
h6 { font-size: .75em; margin: auto }
h1, h2, h3, h4,
h5, h6, b,
strong { font-weight: bolder }
blockquote { margin-left: 40px; margin-right: 40px }
i, cite, em,
var, address { font-style: italic }
pre, tt, code,
kbd, samp { font-family: monospace }
pre { white-space: pre }
button, textarea,
input, select { display: inline-block }
big { font-size: 1.17em }
small, sub, sup { font-size: .83em }
sub { vertical-align: sub }
sup { vertical-align: super }
table { border-spacing: 2px; }
thead, tbody,
tfoot { vertical-align: middle }
td, th, tr { vertical-align: inherit }
s, strike, del { text-decoration: line-through }
hr { border: 1px inset }
ol, ul, dir,
menu, dd { margin-left: 40px }
ol { list-style-type: decimal }
ol ul, ul ol,
ul ul, ol ol { margin-top: 0; margin-bottom: 0 }
u, ins { text-decoration: underline }
br:before { content: ""\A""; white-space: pre-line }
center { text-align: center }
:link, :visited { text-decoration: underline }
:focus { outline: thin dotted invert }
/* Begin bidirectionality settings (do not change) */
BDO[DIR=""ltr""] { direction: ltr; unicode-bidi: bidi-override }
BDO[DIR=""rtl""] { direction: rtl; unicode-bidi: bidi-override }
*[DIR=""ltr""] { direction: ltr; unicode-bidi: embed }
*[DIR=""rtl""] { direction: rtl; unicode-bidi: embed }

";

  private static readonly string userCss = @"";
  /*
    private static readonly string[] s_productNames =
    {
              "Unicycle",
              "Bicycle",
              "Tricycle",
              "Skateboard",
              "Roller Blades",
              "Hang Glider",
          };

    private static XElement GenerateDataFromDataSource(FileInfo dataFi, int numberOfDocumentsToGenerate)
    {
      var customers = new XElement("Customers");
      var r = new Random();
      for (var i = 0; i < numberOfDocumentsToGenerate; ++i)
      {
        var customer = new XElement(
            "Customer",
            new XElement("CustomerID", i + 1),
            new XElement("Name", "Eric White"),
            new XElement("HighValueCustomer", r.Next(2) == 0 ? "True" : "False"),
            new XElement("Orders")
        );
        var orders = customer.Element("Orders");
        var numberOfOrders = r.Next(10) + 1;
        for (var j = 0; j < numberOfOrders; j++)
        {
          var order = new XElement(
              "Order",
              new XAttribute("Number", j + 1),
              new XElement("ProductDescription", s_productNames[r.Next(s_productNames.Length)]),
              new XElement("Quantity", r.Next(10)),
              new XElement("OrderDate", "September 26, 2015")
          );
          orders.Add(order);
        }
        customers.Add(customer);
      }
      customers.Save(dataFi.FullName);
      return customers;
    }
   */
  public static FileInfo ConvertToHtmlOLd(string file, string outputDirectory)
  {
    // Console.WriteLine($"Conversion ConvertToHtml: {file},{outputDirectory}");
    var fi = new FileInfo(file);
    var byteArray = File.ReadAllBytes(fi.FullName);
    using var memoryStream = new MemoryStream();
    memoryStream.Write(byteArray, 0, byteArray.Length);
    using var wDoc = WordprocessingDocument.Open(memoryStream, true);
    var comments = ExtractComments(wDoc);
    InjectCommentMarkers(wDoc, comments);
    var destFileName = new FileInfo(fi.Name.Replace(".docx", ".html"));
    destFileName = new FileInfo(Path.Combine(outputDirectory, destFileName.Name));
    // destFileName = new FileInfo(Path.Combine(TempDir, destFileName.Name));

    var imageDirectoryName = destFileName.FullName.Substring(0, destFileName.FullName.Length - 5) + "_files";
    var imageCounter = 0;

    var pageTitle = fi.FullName;
    var part = wDoc.CoreFilePropertiesPart;
    if (part != null)
    {
      pageTitle = (string)part.GetXDocument().Descendants(DC.title).FirstOrDefault() ?? fi.FullName;
    }

    // TODO: Determine max-width from size of content area.
    var settings = new WmlToHtmlConverterSettings()
    {
      // AdditionalCss = "body { margin: 1cm auto; max-width: 20cm; padding: 0; }",
      AdditionalCss = "body { margin: inherit; max-width: inherit; padding: inherit; }",
      PageTitle = pageTitle,


      // Force inline styles instead of classes
      FabricateCssClasses = false,
      CssClassPrefix = "",
      RestrictToSupportedLanguages = false,
      RestrictToSupportedNumberingFormats = false,

      // FabricateCssClasses = true,
      // CssClassPrefix = "pt-",
      // RestrictToSupportedLanguages = false,
      // RestrictToSupportedNumberingFormats = false,


      ImageHandler = imageInfo =>
      {
        ++imageCounter;
        return ImageHelper.DefaultImageHandler(imageInfo, imageDirectoryName, imageCounter);
      },
    };
    var htmlElement = WmlToHtmlConverter.ConvertToHtml(wDoc, settings);

    // Produce HTML document with <!DOCTYPE html > declaration to tell the browser
    // we are using HTML5.
    var html = new XDocument(new XDocumentType("html", null, null, null), htmlElement);

    // Note: the xhtml returned by ConvertToHtmlTransform contains objects of type
    // XEntity.  PtOpenXmlUtil.cs define the XEntity class.  See
    // http://blogs.msdn.com/ericwhite/archive/2010/01/21/writing-entity-references-using-linq-to-xml.aspx
    // for detailed explanation.
    //
    // If you further transform the XML tree returned by ConvertToHtmlTransform, you
    // must do it correctly, or entities will not be serialized properly.

    var htmlString = html.ToString(SaveOptions.DisableFormatting);
    htmlString = ReplaceCommentMarkers(htmlString);

    // Ensure output folder exists
    Directory.CreateDirectory(outputDirectory);
    // Save HTML
    File.WriteAllText(destFileName.FullName, htmlString, Encoding.UTF8);
    // File.WriteAllText(destFileName.FullName, htmlString, Encoding.UTF8);

    // Console.WriteLine($"Conversion destFileName: {file},{destFileName},{destFileName.FullName}");
    // Console.WriteLine($"{outputPath}");

    // Save HTML
    // File.WriteAllText(outputPath, html);

    // Console.WriteLine($"✅ Conversion successful! HTML saved to: {outputPath}");
    Console.WriteLine($"{destFileName}");


    return destFileName;
  }

 
public static FileInfo ConvertToHtml(string file, string outputDirectory)
{
    // 1. Validate input file
    var fi = new FileInfo(file);
    if (!fi.Exists)
    {
        throw new FileNotFoundException($"The source file could not be found: {file}");
    }

    // 2. Open the document safely using standard FileStream access via OpenXml
    using var wDoc = WordprocessingDocument.Open(fi.FullName, true);
    
    // Crucial check: WmlToHtmlConverter requires MainDocumentPart to not be null.
    // If this throws, your input .docx file is corrupt or improperly formatted.
    if (wDoc.MainDocumentPart == null)
    {
        throw new InvalidDataException("Error: The document does not contain a MainDocumentPart. It might be empty or corrupted.");
    }

    // 3. Process markers and comments
    var comments = ExtractComments(wDoc);
    InjectCommentMarkers(wDoc, comments);

    // 4. Resolve output and directory paths safely (Fixes CS8602 warning)
    string htmlFileName = Path.GetFileNameWithoutExtension(fi.Name) + ".html";
    var destFileName = new FileInfo(Path.Combine(outputDirectory, htmlFileName));
    
    // string imageDirectoryName = Path.Combine(outputDirectory, Path.GetFileNameWithoutExtension(fi.Name) + "_files");
    
// Leverage your converted configuration helper to get the sub-folder path cleanly
// Pass the AssetType constraint safely
string relativeAssetPath = DocumentModel.GetAssetRelativePath(DocumentModel.AssetType.IMG);

string imageDirectoryName = Path.Combine(outputDirectory, relativeAssetPath);

// Result string format layout generated:
// {outputDirectory}/assets/img/

    var imageCounter = 0;

    // 5. Resolve Page Title
    var pageTitle = fi.FullName;
    var part = wDoc.CoreFilePropertiesPart;
    if (part != null)
    {
        pageTitle = (string)part.GetXDocument().Descendants(DC.title).FirstOrDefault() ?? fi.FullName;
    }

    // 6. Setup Converter Settings
    var settings = new WmlToHtmlConverterSettings()
    {
        AdditionalCss = "body { margin: inherit; max-width: inherit; padding: inherit; }",
        PageTitle = pageTitle,

        // Force inline styles instead of classes as per your configuration
        FabricateCssClasses = false,
        CssClassPrefix = "",
        RestrictToSupportedLanguages = false,
        RestrictToSupportedNumberingFormats = false,

        ImageHandler = imageInfo =>
        {
            ++imageCounter;
            return ImageHelper.DefaultImageHandler(imageInfo, imageDirectoryName, imageCounter);
        },
    };

    // 7. Convert to HTML core element
    var htmlElement = WmlToHtmlConverter.ConvertToHtml(wDoc, settings);

    // 8. Produce HTML document with <!DOCTYPE html> declaration
    var html = new XDocument(new XDocumentType("html", null, null, null), htmlElement);
    var htmlString = html.ToString(SaveOptions.DisableFormatting);
    htmlString = ReplaceCommentMarkers(htmlString);

    // 9. Save outputs
    Directory.CreateDirectory(outputDirectory);
    File.WriteAllText(destFileName.FullName, htmlString, Encoding.UTF8);

    Console.WriteLine($"{destFileName}");

    return destFileName;
}
}
