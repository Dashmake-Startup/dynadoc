using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Presentation;
using A = DocumentFormat.OpenXml.Drawing;

public class DynadocPresentation
{
  public string Version { get; set; } = "1.0";
  public double WidthPx { get; set; }
  public double HeightPx { get; set; }
  public string AssetsBasePath { get; set; } = "";
  public List<DynadocSlide> Slides { get; set; } = new();
}

public class DynadocSlide
{
  public string Id { get; set; } = Guid.NewGuid().ToString("N");
  public int SlideIndex { get; set; }
  public string Name { get; set; } = "";
  public DynadocTransition? Transition { get; set; }
  public object? Background { get; set; }
  public string? Notes { get; set; }
  public List<DynadocSlideComment> Comments { get; set; } = new();
  public DynadocMasterLayout? Master { get; set; }
  public List<DynadocElement> Elements { get; set; } = new();
}

public class DynadocTransition
{
  public string? Type { get; set; }
  public int? DurationMs { get; set; }
  public string? Direction { get; set; }
}

public class DynadocElement
{
  public string Id { get; set; } = Guid.NewGuid().ToString("N");
  public string Type { get; set; } = "text"; // text | image | shape
  public string Name { get; set; } = "";
  public double X { get; set; }
  public double Y { get; set; }
  public double Width { get; set; }
  public double Height { get; set; }
  public double Rotation { get; set; }
  public string? Src { get; set; }
  public string? Shape { get; set; }
  public string? Text { get; set; }
  public object? TiptapContent { get; set; }
  public string? Fill { get; set; }
  public string? Stroke { get; set; }
  public double? StrokeWidth { get; set; }
  public object? Animation { get; set; }
}

public class DynadocSlideComment
{
  public string Id { get; set; } = Guid.NewGuid().ToString("N");
  public string? Author { get; set; }
  public string? Text { get; set; }
  public string? CreatedAt { get; set; }
  public bool Resolved { get; set; }
}

public class DynadocMasterLayout
{
  public object? Background { get; set; }
  public List<DynadocElement> Elements { get; set; } = new();
}

public class DynadocGradientStop
{
  public double Position { get; set; }
  public string Color { get; set; } = "";
}

public class DynadocGradient
{
  public string Type { get; set; } = "linear";
  public double? Angle { get; set; }
  public List<DynadocGradientStop> Stops { get; set; } = new();
}

public static class PptxToDynadocConverter
{
  private const double EmuPerInch = 914400.0;
  private const double PxPerInch = 96.0;

  public static string Convert(string inputPath, string outputDir)
  {
    var baseName = Path.GetFileNameWithoutExtension(inputPath);
    var targetRoot = string.IsNullOrWhiteSpace(outputDir)
      ? Path.Combine(Environment.CurrentDirectory, baseName)
      : Path.Combine(outputDir, baseName);
    try
    {
      Directory.CreateDirectory(targetRoot);
    }
    catch (UnauthorizedAccessException)
    {
      var fallbackRoot = Path.Combine(Path.GetTempPath(), $"dynadoc-pptx-{baseName}-{Guid.NewGuid():N}");
      Directory.CreateDirectory(fallbackRoot);
      targetRoot = fallbackRoot;
    }
    var presentation = ExtractPresentation(inputPath, targetRoot);
    var jsonPath = Path.Combine(targetRoot, "presentation.json");
    var jsonOptions = new JsonSerializerOptions
    {
      WriteIndented = true,
      PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    File.WriteAllText(jsonPath, JsonSerializer.Serialize(presentation, jsonOptions));
    Console.WriteLine($"Dynadoc presentation exported to: {jsonPath}");
    return jsonPath;
  }

  private static DynadocPresentation ExtractPresentation(string inputPath, string outputDir)
  {
    using var doc = PresentationDocument.Open(inputPath, false);
    var presentationPart = doc.PresentationPart;
    if (presentationPart?.Presentation == null)
    {
      return new DynadocPresentation();
    }

    var assetsDir = Path.Combine(outputDir, "assets", "img");
    Directory.CreateDirectory(assetsDir);

    var slideSize = presentationPart.Presentation.SlideSize;
    var presentation = new DynadocPresentation
    {
      WidthPx = EmuToPx(slideSize?.Cx ?? 0),
      HeightPx = EmuToPx(slideSize?.Cy ?? 0),
      AssetsBasePath = assetsDir
    };
    var theme = presentationPart.ThemePart?.Theme;

    var slideParts = presentationPart.SlideParts.ToList();
    for (var i = 0; i < slideParts.Count; i++)
    {
      var slidePart = slideParts[i];
      var slide = new DynadocSlide
      {
        SlideIndex = i,
        Name = slidePart.Slide?.CommonSlideData?.Name ?? $"Slide {i + 1}",
        Transition = ExtractTransition(slidePart.Slide),
        Background = ExtractBackground(slidePart.Slide?.CommonSlideData?.Background, theme),
        Notes = ExtractNotes(slidePart),
        Comments = ExtractComments(slidePart, presentationPart),
        Master = ExtractMasterLayout(slidePart, theme)
      };

      ExtractTextElements(slidePart, slide, theme);
      ExtractImageElements(slidePart, assetsDir, slide);
      ExtractShapeElements(slidePart, slide, theme);

      presentation.Slides.Add(slide);
    }

    return presentation;
  }

  private static void ExtractTextElements(SlidePart slidePart, DynadocSlide slide, A.Theme? theme)
  {
    foreach (var shape in slidePart.Slide.Descendants<Shape>())
    {
      if (shape.TextBody == null) continue;
      var transform = shape.ShapeProperties?.Transform2D;
      var text = ExtractPlainText(shape.TextBody);
      if (string.IsNullOrWhiteSpace(text)) continue;

      var element = new DynadocElement
      {
        Type = "text",
        Name = shape.NonVisualShapeProperties?.NonVisualDrawingProperties?.Name ?? "Text",
        Text = text,
        TiptapContent = BuildTiptapContent(shape.TextBody, theme)
      };
      ApplyTransform(element, transform);
      slide.Elements.Add(element);
    }
  }

  private static void ExtractImageElements(SlidePart slidePart, string assetsDir, DynadocSlide slide)
  {
    var index = 0;
    foreach (var picture in slidePart.Slide.Descendants<Picture>())
    {
      var blip = picture.BlipFill?.Blip;
      if (blip?.Embed == null) continue;

      var imagePart = slidePart.GetPartById(blip.Embed) as ImagePart;
      if (imagePart == null) continue;

      var ext = GetImageExtension(imagePart.ContentType);
      var fileName = $"slide-{slide.SlideIndex + 1}-image-{index + 1}{ext}";
      var outputPath = Path.Combine(assetsDir, fileName);
      using (var stream = imagePart.GetStream(FileMode.Open, FileAccess.Read))
      using (var output = File.Create(outputPath))
      {
        stream.CopyTo(output);
      }

      var element = new DynadocElement
      {
        Type = "image",
        Name = picture.NonVisualPictureProperties?.NonVisualDrawingProperties?.Name ?? "Image",
        Src = fileName
      };
      ApplyTransform(element, picture.ShapeProperties?.Transform2D);
      slide.Elements.Add(element);
      index++;
    }
  }

  private static void ExtractShapeElements(SlidePart slidePart, DynadocSlide slide, A.Theme? theme)
  {
    foreach (var shape in slidePart.Slide.Descendants<Shape>())
    {
      if (shape.TextBody != null) continue;
      var preset = shape.ShapeProperties?.GetFirstChild<A.PresetGeometry>()?.Preset;
      if (preset == null) continue;

      var element = new DynadocElement
      {
        Type = "shape",
        Name = shape.NonVisualShapeProperties?.NonVisualDrawingProperties?.Name ?? "Shape",
        Shape = preset.Value.ToString().ToLowerInvariant()
      };
      ApplyFillStroke(element, shape.ShapeProperties, theme);
      ApplyTransform(element, shape.ShapeProperties?.Transform2D);
      slide.Elements.Add(element);
    }
  }

  private static DynadocTransition? ExtractTransition(Slide? slide)
  {
    var transition = slide?.Transition;
    if (transition == null) return null;

    var child = transition.ChildElements.FirstOrDefault();
    var type = child?.LocalName ?? "fade";

    int? duration = null;
    var speedValue = transition.Speed?.Value;
    if (speedValue.HasValue)
    {
      if (speedValue.Value == TransitionSpeedValues.Fast) duration = 300;
      else if (speedValue.Value == TransitionSpeedValues.Medium) duration = 600;
      else if (speedValue.Value == TransitionSpeedValues.Slow) duration = 900;
    }

    var dirAttr = child?.GetAttribute("dir", string.Empty);
    var direction = dirAttr?.Value ?? string.Empty;

    return new DynadocTransition
    {
      Type = type,
      DurationMs = duration,
      Direction = direction
    };
  }

  private static string ExtractPlainText(OpenXmlCompositeElement body)
  {
    return string.Join("\n", body.Descendants<A.Text>().Select(t => t.Text)).Trim();
  }

  private static object BuildTiptapContent(OpenXmlCompositeElement body, A.Theme? theme)
  {
    var paragraphs = new List<Dictionary<string, object>>();
    foreach (var para in body.Descendants<A.Paragraph>())
    {
      var runs = new List<Dictionary<string, object>>();
      var paraAttrs = BuildParagraphAttrs(para.ParagraphProperties);
      foreach (var run in para.Elements<A.Run>())
      {
        var text = run.Text?.Text ?? "";
        if (string.IsNullOrEmpty(text)) continue;
        var marks = BuildMarks(run.RunProperties, theme);
        var node = new Dictionary<string, object>
        {
          ["type"] = "text",
          ["text"] = text
        };
        if (marks.Count > 0)
        {
          node["marks"] = marks;
        }
        runs.Add(node);
      }

      if (runs.Count == 0) continue;
      var paragraphNode = new Dictionary<string, object>
      {
        ["type"] = "paragraph",
        ["content"] = runs
      };
      if (paraAttrs.Count > 0)
      {
        paragraphNode["attrs"] = paraAttrs;
      }
      paragraphs.Add(paragraphNode);
    }

    if (paragraphs.Count == 0)
    {
      paragraphs.Add(new Dictionary<string, object> { ["type"] = "paragraph" });
    }

    return new Dictionary<string, object>
    {
      ["type"] = "doc",
      ["content"] = paragraphs
    };
  }

  private static List<Dictionary<string, object>> BuildMarks(A.RunProperties? props, A.Theme? theme)
  {
    var marks = new List<Dictionary<string, object>>();
    if (props == null) return marks;
    var textStyleAttrs = new Dictionary<string, object>();
    if (props.Bold?.Value == true)
    {
      marks.Add(new Dictionary<string, object> { ["type"] = "bold" });
      textStyleAttrs["fontWeight"] = "bold";
    }
    if (props.Italic?.Value == true)
    {
      marks.Add(new Dictionary<string, object> { ["type"] = "italic" });
      textStyleAttrs["fontStyle"] = "italic";
    }
    if (props.Underline?.Value != null && props.Underline?.Value != A.TextUnderlineValues.None)
    {
      marks.Add(new Dictionary<string, object> { ["type"] = "underline" });
      textStyleAttrs["textDecoration"] = "underline";
    }
    var fontSize = ExtractFontSize(props);
    if (!string.IsNullOrWhiteSpace(fontSize))
    {
      textStyleAttrs["fontSize"] = fontSize;
    }
    var fontFamily = ExtractFontFamily(props);
    if (!string.IsNullOrWhiteSpace(fontFamily))
    {
      textStyleAttrs["fontFamily"] = fontFamily;
    }
    var color = ExtractRunColor(props, theme);
    if (!string.IsNullOrWhiteSpace(color))
    {
      textStyleAttrs["color"] = color;
    }
    if (textStyleAttrs.Count > 0)
    {
      marks.Add(new Dictionary<string, object>
      {
        ["type"] = "textStyle",
        ["attrs"] = textStyleAttrs
      });
    }
    return marks;
  }

  private static Dictionary<string, object> BuildParagraphAttrs(A.ParagraphProperties? props)
  {
    var attrs = new Dictionary<string, object>();
    if (props == null) return attrs;
    var align = ExtractTextAlign(props);
    if (!string.IsNullOrWhiteSpace(align))
    {
      attrs["textAlign"] = align;
    }
    var lineHeight = ExtractLineHeight(props);
    if (!string.IsNullOrWhiteSpace(lineHeight))
    {
      attrs["lineHeight"] = lineHeight;
    }
    return attrs;
  }

  private static string? ExtractFontSize(A.RunProperties props)
  {
    var size = props?.FontSize?.Value;
    if (!size.HasValue || size.Value <= 0) return null;
    var pt = size.Value / 100.0;
    return $"{pt:0.##}pt";
  }

  private static string? ExtractFontFamily(A.RunProperties props)
  {
    var latin = props?.GetFirstChild<A.LatinFont>();
    var typeface = latin?.Typeface?.Value ?? latin?.Typeface;
    if (string.IsNullOrWhiteSpace(typeface)) return null;
    return typeface;
  }

  private static string? ExtractRunColor(A.RunProperties props, A.Theme? theme)
  {
    var solid = props?.GetFirstChild<A.SolidFill>();
    return ExtractColorFromSolidFill(solid, theme);
  }

  private static string? ExtractColorFromSolidFill(A.SolidFill? solid, A.Theme? theme = null)
  {
    if (solid == null) return null;
    var rgb = solid.RgbColorModelHex?.Val?.Value ?? solid.RgbColorModelHex?.Val;
    if (!string.IsNullOrWhiteSpace(rgb)) return $"#{rgb}";
    var srgb = solid.GetFirstChild<A.RgbColorModelHex>()?.Val?.Value;
    if (!string.IsNullOrWhiteSpace(srgb)) return $"#{srgb}";
    var scheme = solid.GetFirstChild<A.SchemeColor>();
    if (scheme != null)
    {
      var resolved = ResolveThemeColor(scheme, theme);
      if (!string.IsNullOrWhiteSpace(resolved)) return resolved;
    }
    return null;
  }

  private static string? ExtractTextAlign(A.ParagraphProperties? props)
  {
    if (props == null) return null;
    var raw = SafeGetAttributeValue(props, "algn");
    if (string.IsNullOrWhiteSpace(raw) && props.Alignment != null)
    {
      raw = props.Alignment.Value.ToString();
    }
    if (string.IsNullOrWhiteSpace(raw)) return null;
    raw = raw.ToLowerInvariant();
    if (raw.Contains("ctr") || raw.Contains("center")) return "center";
    if (raw.StartsWith("r")) return "right";
    if (raw.StartsWith("just")) return "justify";
    return "left";
  }

  private static string? ExtractLineHeight(A.ParagraphProperties? props)
  {
    if (props == null) return null;
    var spacing = props.ChildElements.FirstOrDefault(e => e.LocalName == "lnSpc");
    if (spacing == null) return null;

    string? pctRaw = null;
    var pctNode = spacing.ChildElements.FirstOrDefault(e => e.LocalName == "spcPct");
    if (pctNode != null)
    {
      pctRaw = SafeGetAttributeValue(pctNode, "val");
    }
    if (!string.IsNullOrWhiteSpace(pctRaw) && int.TryParse(pctRaw, out var pctVal) && pctVal > 0)
    {
      var ratio = pctVal / 100000.0;
      return ratio.ToString("0.###");
    }

    string? ptsRaw = null;
    var ptsNode = spacing.ChildElements.FirstOrDefault(e => e.LocalName == "spcPts");
    if (ptsNode != null)
    {
      ptsRaw = SafeGetAttributeValue(ptsNode, "val");
    }
    if (!string.IsNullOrWhiteSpace(ptsRaw) && int.TryParse(ptsRaw, out var ptsVal) && ptsVal > 0)
    {
      var pt = ptsVal / 100.0;
      return $"{pt:0.##}pt";
    }

    return null;
  }

  private static string? ExtractNotes(SlidePart slidePart)
  {
    var notes = slidePart.NotesSlidePart?.NotesSlide;
    if (notes == null) return null;
    var text = string.Join("\n", notes.Descendants<A.Text>().Select(t => t.Text)).Trim();
    return string.IsNullOrWhiteSpace(text) ? null : text;
  }

  private static List<DynadocSlideComment> ExtractComments(
    SlidePart slidePart,
    PresentationPart? presentationPart
  )
  {
    var comments = new List<DynadocSlideComment>();
    var commentPart = slidePart.SlideCommentsPart;
    if (commentPart?.CommentList == null) return comments;

    var authorMap = new Dictionary<string, string>();
    var authors = presentationPart?.CommentAuthorsPart?.CommentAuthorList?.Elements<CommentAuthor>();
    if (authors != null)
    {
      foreach (var author in authors)
      {
        var id = author.Id?.Value.ToString() ?? "";
        if (!string.IsNullOrWhiteSpace(id))
        {
          authorMap[id] = author.Name?.Value ?? author.Initials?.Value ?? id;
        }
      }
    }

    foreach (var comment in commentPart.CommentList.Elements<Comment>())
    {
      var idAttr = SafeGetAttributeValue(comment, "id") ?? string.Empty;
      var authorAttr = SafeGetAttributeValue(comment, "authorId") ?? string.Empty;
      var dateAttr = SafeGetAttributeValue(comment, "dt") ?? string.Empty;
      var id = !string.IsNullOrWhiteSpace(idAttr) ? idAttr : Guid.NewGuid().ToString("N");
      var authorId = !string.IsNullOrWhiteSpace(authorAttr) ? authorAttr : "";
      var authorName = authorMap.ContainsKey(authorId) ? authorMap[authorId] : authorId;
      var text = string.Join("\n", comment.Descendants<A.Text>().Select(t => t.Text)).Trim();
      if (string.IsNullOrWhiteSpace(text))
      {
        text = comment.InnerText ?? "";
      }
      DateTime? created = null;
      if (!string.IsNullOrWhiteSpace(dateAttr) && DateTime.TryParse(dateAttr, out var parsed))
      {
        created = parsed;
      }
      comments.Add(new DynadocSlideComment
      {
        Id = id,
        Author = authorName,
        Text = text,
        CreatedAt = created.HasValue ? created.Value.ToString("o") : null,
        Resolved = false
      });
    }

    return comments;
  }

  private static DynadocMasterLayout? ExtractMasterLayout(SlidePart slidePart, A.Theme? theme)
  {
    var layout = slidePart.SlideLayoutPart?.SlideLayout;
    var master = slidePart.SlideLayoutPart?.SlideMasterPart?.SlideMaster;
    if (layout == null && master == null) return null;

    var masterLayout = new DynadocMasterLayout();
    masterLayout.Background =
      ExtractBackground(layout?.CommonSlideData?.Background, theme) ??
      ExtractBackground(master?.CommonSlideData?.Background, theme);

    var elements = new List<DynadocElement>();
    if (layout != null)
    {
      ExtractMasterShapes(layout, elements, theme);
    }
    if (master != null)
    {
      ExtractMasterShapes(master, elements, theme);
    }
    masterLayout.Elements = elements;
    return masterLayout;
  }

  private static void ExtractMasterShapes(OpenXmlCompositeElement root, List<DynadocElement> elements, A.Theme? theme)
  {
    foreach (var shape in root.Descendants<Shape>())
    {
      if (shape.TextBody != null) continue;
      var preset = shape.ShapeProperties?.GetFirstChild<A.PresetGeometry>()?.Preset;
      if (preset == null) continue;
      var element = new DynadocElement
      {
        Type = "shape",
        Name = shape.NonVisualShapeProperties?.NonVisualDrawingProperties?.Name ?? "Master Shape",
        Shape = preset.Value.ToString().ToLowerInvariant()
      };
      ApplyFillStroke(element, shape.ShapeProperties, theme);
      ApplyTransform(element, shape.ShapeProperties?.Transform2D);
      elements.Add(element);
    }
  }

  private static object? ExtractBackground(Background? background, A.Theme? theme)
  {
    if (background == null) return null;
    var props = background.BackgroundProperties;
    if (props == null) return null;
    var solidFill = props.GetFirstChild<A.SolidFill>();
    var solid = ExtractColorFromSolidFill(solidFill, theme);
    if (!string.IsNullOrWhiteSpace(solid)) return solid;

    var gradFill = props.GetFirstChild<A.GradientFill>();
    var gradient = ExtractGradientFill(gradFill, theme);
    return gradient;
  }

  private static DynadocGradient? ExtractGradientFill(A.GradientFill? gradFill, A.Theme? theme)
  {
    if (gradFill == null) return null;
    var stopList = gradFill.GradientStopList;
    if (stopList == null) return null;

    var gradient = new DynadocGradient();
    var linear = gradFill.GetFirstChild<A.LinearGradientFill>();
    if (linear?.Angle != null)
    {
      gradient.Angle = linear.Angle.Value / 60000.0;
    }

    foreach (var stop in stopList.Elements<A.GradientStop>())
    {
      var position = stop.Position?.Value ?? 0;
      var color = ExtractColorFromColorElement(stop, theme);
      if (string.IsNullOrWhiteSpace(color)) continue;
      gradient.Stops.Add(new DynadocGradientStop
      {
        Position = Math.Max(0, Math.Min(1, position / 100000.0)),
        Color = color
      });
    }

    return gradient.Stops.Count > 0 ? gradient : null;
  }

  private static string? ExtractColorFromColorElement(OpenXmlElement? element, A.Theme? theme, bool resolveScheme = true)
  {
    if (element == null) return null;
    var rgb = element.GetFirstChild<A.RgbColorModelHex>()?.Val?.Value;
    if (!string.IsNullOrWhiteSpace(rgb)) return $"#{rgb}";
    var sys = element.GetFirstChild<A.SystemColor>()?.LastColor?.Value;
    if (!string.IsNullOrWhiteSpace(sys)) return $"#{sys}";
    if (resolveScheme)
    {
      var scheme = element.GetFirstChild<A.SchemeColor>();
      if (scheme != null)
      {
        var resolved = ResolveThemeColor(scheme, theme);
        if (!string.IsNullOrWhiteSpace(resolved)) return resolved;
      }
    }
    return null;
  }

  private static string? ResolveThemeColor(A.SchemeColor scheme, A.Theme? theme)
  {
    if (theme?.ThemeElements?.ColorScheme == null) return null;
    var schemeVal = scheme.Val?.Value;
    var colors = theme.ThemeElements.ColorScheme;

    OpenXmlElement? colorEntry = null;
    if (schemeVal != null)
    {
      var key = schemeVal.ToString().ToLowerInvariant();
      switch (key)
      {
        case "background1":
          colorEntry = colors.Light1Color;
          break;
        case "text1":
          colorEntry = colors.Dark1Color;
          break;
        case "background2":
          colorEntry = colors.Light2Color;
          break;
        case "text2":
          colorEntry = colors.Dark2Color;
          break;
        case "accent1":
          colorEntry = colors.Accent1Color;
          break;
        case "accent2":
          colorEntry = colors.Accent2Color;
          break;
        case "accent3":
          colorEntry = colors.Accent3Color;
          break;
        case "accent4":
          colorEntry = colors.Accent4Color;
          break;
        case "accent5":
          colorEntry = colors.Accent5Color;
          break;
        case "accent6":
          colorEntry = colors.Accent6Color;
          break;
        case "hyperlink":
          colorEntry = colors.Hyperlink;
          break;
        case "followedhyperlink":
        case "followed_hyperlink":
          colorEntry = colors.GetFirstChild<A.FollowedHyperlinkColor>();
          break;
      }
    }

    return ExtractColorFromColorElement(colorEntry, theme, false);
  }

  private static void ApplyFillStroke(DynadocElement element, OpenXmlElement? props, A.Theme? theme = null)
  {
    if (props == null) return;
    var fill = props.GetFirstChild<A.SolidFill>();
    var fillColor = ExtractColorFromSolidFill(fill, theme);
    if (!string.IsNullOrWhiteSpace(fillColor)) element.Fill = fillColor;

    var outline = props.GetFirstChild<A.Outline>();
    if (outline != null)
    {
      var lineFill = outline.GetFirstChild<A.SolidFill>();
      var strokeColor = ExtractColorFromSolidFill(lineFill, theme);
      if (!string.IsNullOrWhiteSpace(strokeColor)) element.Stroke = strokeColor;
      var width = outline.Width?.Value;
      if (width.HasValue)
      {
        element.StrokeWidth = EmuToPx(width.Value);
      }
    }
  }

  private static void ApplyTransform(DynadocElement element, A.Transform2D transform)
  {
    if (transform == null) return;
    var offset = transform.Offset;
    var extents = transform.Extents;
    element.X = EmuToPx(offset?.X ?? 0);
    element.Y = EmuToPx(offset?.Y ?? 0);
    element.Width = EmuToPx(extents?.Cx ?? 0);
    element.Height = EmuToPx(extents?.Cy ?? 0);
    element.Rotation = (transform.Rotation?.Value ?? 0) / 60000.0;
  }

  private static double EmuToPx(long value) => value <= 0 ? 0 : (value / EmuPerInch) * PxPerInch;

  private static string GetImageExtension(string contentType)
  {
    return contentType switch
    {
      "image/png" => ".png",
      "image/jpeg" => ".jpg",
      "image/jpg" => ".jpg",
      "image/gif" => ".gif",
      "image/bmp" => ".bmp",
      "image/tiff" => ".tiff",
      _ => ".png"
    };
  }

  private static string? SafeGetAttributeValue(OpenXmlElement element, string localName)
  {
    try
    {
      var attr = element.GetAttribute(localName, element.NamespaceUri);
      if (!string.IsNullOrWhiteSpace(attr.Value)) return attr.Value;
    }
    catch
    {
      // ignore schema validation errors
    }
    try
    {
      var attr = element.GetAttribute(localName, string.Empty);
      if (!string.IsNullOrWhiteSpace(attr.Value)) return attr.Value;
    }
    catch
    {
      // ignore schema validation errors
    }
    return null;
  }
}
