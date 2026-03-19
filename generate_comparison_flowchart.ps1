Add-Type -AssemblyName System.Drawing

$width = 1800
$height = 3300
$outputPath = Join-Path $PSScriptRoot "comparison_flowchart.png"

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#0b1424"))

function New-Brush($hex) {
    return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($hex, $width = 2) {
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    return $pen
}

function Measure-WrappedText([System.Drawing.Graphics]$graphics, [string]$text, [System.Drawing.Font]$font, [float]$widthLimit) {
    $size = $graphics.MeasureString($text, $font, [int][Math]::Ceiling($widthLimit))
    return New-Object System.Drawing.SizeF($size.Width, $size.Height)
}

function Draw-RoundedRect(
    [System.Drawing.Graphics]$graphics,
    [float]$x,
    [float]$y,
    [float]$w,
    [float]$h,
    [float]$radius,
    [System.Drawing.Brush]$fillBrush,
    [System.Drawing.Pen]$borderPen
) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $w - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $w - $diameter, $y + $h - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $h - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath($fillBrush, $path)
    $graphics.DrawPath($borderPen, $path)
    $path.Dispose()
}

function Draw-Box(
    [System.Drawing.Graphics]$graphics,
    [hashtable]$node,
    [System.Drawing.Font]$titleFont,
    [System.Drawing.Font]$bodyFont,
    [System.Drawing.Brush]$titleBrush,
    [System.Drawing.Brush]$bodyBrush
) {
    $x = [single]$node["x"]
    $y = [single]$node["y"]
    $w = [single]$node["w"]
    $h = [single]$node["h"]
    $fillBrush = New-Brush $node["fill"]
    $borderPen = New-Pen $node["border"] 2.2
    Draw-RoundedRect $graphics $x $y $w $h 18 $fillBrush $borderPen

    $padX = 18
    $titleY = $y + 14
    $bodyY = $y + 52

    $titleRect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($x + $padX)), ([single]$titleY), ([single]($w - ($padX * 2))), ([single]30)
    $bodyRect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($x + $padX)), ([single]$bodyY), ([single]($w - ($padX * 2))), ([single]($h - 68))

    $graphics.DrawString([string]$node["title"], $titleFont, $titleBrush, $titleRect)
    $graphics.DrawString([string]$node["body"], $bodyFont, $bodyBrush, $bodyRect)

    $fillBrush.Dispose()
    $borderPen.Dispose()
}

function Draw-Diamond(
    [System.Drawing.Graphics]$graphics,
    [hashtable]$node,
    [System.Drawing.Font]$titleFont,
    [System.Drawing.Font]$bodyFont,
    [System.Drawing.Brush]$titleBrush,
    [System.Drawing.Brush]$bodyBrush
) {
    $x = [single]$node["x"]
    $y = [single]$node["y"]
    $w = [single]$node["w"]
    $h = [single]$node["h"]
    [System.Drawing.PointF[]]$points = @(
        (New-Object System.Drawing.PointF -ArgumentList ([single]($x + ($w / 2))), ([single]$y)),
        (New-Object System.Drawing.PointF -ArgumentList ([single]($x + $w)), ([single]($y + ($h / 2)))),
        (New-Object System.Drawing.PointF -ArgumentList ([single]($x + ($w / 2))), ([single]($y + $h))),
        (New-Object System.Drawing.PointF -ArgumentList ([single]$x), ([single]($y + ($h / 2))))
    )
    $fillBrush = New-Brush $node["fill"]
    $borderPen = New-Pen $node["border"] 2.2
    $graphics.FillPolygon($fillBrush, $points)
    $graphics.DrawPolygon($borderPen, $points)

    $titleRect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($x + 28)), ([single]($y + 28)), ([single]($w - 56)), ([single]28)
    $bodyRect = New-Object System.Drawing.RectangleF -ArgumentList ([single]($x + 34)), ([single]($y + 66)), ([single]($w - 68)), ([single]($h - 92))
    $graphics.DrawString([string]$node["title"], $titleFont, $titleBrush, $titleRect)
    $graphics.DrawString([string]$node["body"], $bodyFont, $bodyBrush, $bodyRect)

    $fillBrush.Dispose()
    $borderPen.Dispose()
}

function Draw-Arrow(
    [System.Drawing.Graphics]$graphics,
    [float]$x1,
    [float]$y1,
    [float]$x2,
    [float]$y2,
    [string]$hex,
    [string]$label = "",
    [System.Drawing.Font]$labelFont = $null,
    [System.Drawing.Brush]$labelBrush = $null
) {
    $pen = New-Pen $hex 3
    $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(6, 8)
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    if ($label -and $labelFont -and $labelBrush) {
        $midX = ($x1 + $x2) / 2
        $midY = ($y1 + $y2) / 2
        $graphics.DrawString($label, $labelFont, $labelBrush, $midX + 8, $midY - 18)
    }
    $pen.Dispose()
}

$titleFont = New-Object System.Drawing.Font("Segoe UI Semibold", 15, [System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font("Segoe UI", 11)
$smallFont = New-Object System.Drawing.Font("Segoe UI", 9)
$heroFont = New-Object System.Drawing.Font("Segoe UI Semibold", 26, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Segoe UI", 12)

$titleBrush = New-Brush "#F2F7FF"
$bodyBrush = New-Brush "#D5E4FA"
$mutedBrush = New-Brush "#9CB4D7"
$branchBrush = New-Brush "#F8FBFF"

$g.DrawString("StepOut String Comparison Flow", $heroFont, $titleBrush, 70, 36)
$g.DrawString("Exact backend path from request intake to MATCH / MISMATCH / MISSED / EXTRA", $subFont, $mutedBrush, 72, 82)

$nodes = @(
    @{ id="input"; kind="box"; x=620; y=140; w=560; h=110; fill="#16263D"; border="#4C6EA8"; title="1. Input Intake"; body="app.py receives gold + trainee text or uploaded .txt / .docx, then normalizes and splits both into lists." },
    @{ id="eval"; kind="box"; x=620; y=290; w=560; h=105; fill="#1A2B41"; border="#5677B4"; title="2. Evaluation Start"; body="evaluator.evaluate_match(gold_list, trainee_list, time_tolerance=6000 ms)." },
    @{ id="align"; kind="box"; x=620; y=435; w=560; h=125; fill="#19324A"; border="#4E89BE"; title="3. Sequence Alignment"; body="Dynamic programming aligns whole sequences first. Possible ops: MATCH, DEL, INS. Fast score uses half, timestamp, team, jersey, action." },
    @{ id="op"; kind="diamond"; x=700; y=610; w=400; h=190; fill="#223756"; border="#6A8FC8"; title="Alignment Op?"; body="Is this pair a MATCH, or should trainee be marked EXTRA / gold marked MISSED?" },
    @{ id="missed"; kind="box"; x=110; y=905; w=430; h=115; fill="#2B2E43"; border="#7E89B7"; title="DEL -> Missed"; body="Gold string has no aligned trainee partner. Row status becomes MISSED." },
    @{ id="extra"; kind="box"; x=1260; y=905; w=430; h=115; fill="#41331B"; border="#C69743"; title="INS -> Extra"; body="Trainee string has no aligned gold partner. Row status becomes EXTRA." },
    @{ id="parse"; kind="box"; x=620; y=875; w=560; h=115; fill="#1E304A"; border="#6690C6"; title="4. Parse Both Strings"; body="comparator.compare_strings parses gold and trainee via parser.parse_string(...)." },
    @{ id="valid"; kind="diamond"; x=700; y=1045; w=400; h=190; fill="#4A2232"; border="#D2688A"; title="Parse Valid?"; body="If either string fails format rules, comparison stops and a rule_* format error is returned." },
    @{ id="formaterr"; kind="box"; x=620; y=1295; w=560; h=105; fill="#4B2333"; border="#D96A8C"; title="Format Error"; body="Invalid string format -> mismatch immediately (rule_main_format or rule_trainee_format)." },
    @{ id="half"; kind="box"; x=620; y=1445; w=560; h=105; fill="#20344D"; border="#6C95C7"; title="5. Compare Half First"; body="half_notation is checked first. Different half = hard error." },
    @{ id="timestamp"; kind="box"; x=620; y=1590; w=560; h=125; fill="#213B51"; border="#6F9EC9"; title="6. Compare Timestamp"; body="timestamp is checked second. If drift <= 6000 ms: matched. If drift exists but within tolerance: warning only. If outside tolerance: hard error." },
    @{ id="fields"; kind="box"; x=620; y=1755; w=560; h=135; fill="#1F324A"; border="#6B8FBF"; title="7. Compare Remaining Fields"; body="Compare team, jersey_number, action, attribute, starting_grid, end_grid, foot, special_action. Z-axis fields are skipped for now." },
    @{ id="grid"; kind="diamond"; x=700; y=1945; w=400; h=200; fill="#3A3022"; border="#D2A45A"; title="Grid Mismatch?"; body="starting_grid / end_grid mismatch becomes a warning unless CN or GK is involved as action or special_action." },
    @{ id="rulebook"; kind="box"; x=620; y=2205; w=560; h=125; fill="#21364E"; border="#6F95C4"; title="8. Validate Trainee Rulebook"; body="validate_rulebook(...) runs only on the trainee string. Non-grid rule errors stay hard. Grid rule errors are downgraded to warnings unless CN/GK is involved." },
    @{ id="harderr"; kind="diamond"; x=700; y=2385; w=400; h=190; fill="#3B2432"; border="#D86B8B"; title="Any Hard Errors Left?"; body="Warnings are allowed. Only remaining hard errors decide mismatch." },
    @{ id="matched"; kind="box"; x=180; y=2665; w=500; h=125; fill="#173A34"; border="#4DB79C"; title="MATCHED"; body="No hard errors. Count as correct. Warning may still exist, especially timestamp within tolerance or grid deviation." },
    @{ id="mismatch"; kind="box"; x=1120; y=2665; w=500; h=125; fill="#4A2432"; border="#D96A8C"; title="MISMATCH"; body="One or more hard errors remain. Field errors are counted and stored in mismatched_details." },
    @{ id="final"; kind="box"; x=500; y=2945; w=800; h=155; fill="#18263A"; border="#5E83B8"; title="9. Final Aggregation"; body="Build alignment_rows, mismatched_details, field_errors, insights, timeline_chart, attribute counts. overall_accuracy = correct_count / total_gold * 100." }
)

foreach ($node in $nodes) {
    if ($node.kind -eq "diamond") {
        Draw-Diamond $g $node $titleFont $bodyFont $titleBrush $bodyBrush
    } else {
        Draw-Box $g $node $titleFont $bodyFont $titleBrush $bodyBrush
    }
}

# Main vertical spine
Draw-Arrow $g 900 250 900 290 "#88A8E8"
Draw-Arrow $g 900 395 900 435 "#88A8E8"
Draw-Arrow $g 900 560 900 610 "#88A8E8"
Draw-Arrow $g 900 800 900 875 "#88A8E8" "MATCH" $smallFont $branchBrush
Draw-Arrow $g 900 990 900 1045 "#88A8E8"
Draw-Arrow $g 900 1235 900 1295 "#E27494" "No" $smallFont $branchBrush
Draw-Arrow $g 900 1400 900 1445 "#88A8E8" "Yes" $smallFont $branchBrush
Draw-Arrow $g 900 1550 900 1590 "#88A8E8"
Draw-Arrow $g 900 1715 900 1755 "#88A8E8"
Draw-Arrow $g 900 1890 900 1945 "#88A8E8"
Draw-Arrow $g 900 2145 900 2205 "#88A8E8"
Draw-Arrow $g 900 2330 900 2385 "#88A8E8"
Draw-Arrow $g 900 2790 900 2945 "#88A8E8"

# Branches from alignment op
Draw-Arrow $g 700 705 325 905 "#A8B5E8" "DEL" $smallFont $branchBrush
Draw-Arrow $g 1100 705 1475 905 "#F0C36D" "INS" $smallFont $branchBrush

# Branches from parse valid diamond
Draw-Arrow $g 900 1235 900 1400 "#88A8E8"

# Grid branch helper labels
$g.DrawString("Grid compare is strict only for CN / GK", $subFont, $mutedBrush, 620, 2168)

# Branches from hard errors diamond
Draw-Arrow $g 700 2478 430 2665 "#53C4A7" "No" $smallFont $branchBrush
Draw-Arrow $g 1100 2478 1370 2665 "#E27494" "Yes" $smallFont $branchBrush

# Connect missed / extra / matched / mismatch to final
Draw-Arrow $g 325 1020 325 2860 "#7F8DB8"
Draw-Arrow $g 325 2860 500 3025 "#7F8DB8"
Draw-Arrow $g 1475 1020 1475 2860 "#C69743"
Draw-Arrow $g 1475 2860 1300 3025 "#C69743"
Draw-Arrow $g 430 2790 430 2860 "#53C4A7"
Draw-Arrow $g 1370 2790 1370 2860 "#E27494"

$legendY = 3140
$legendBrush1 = New-Brush "#53C4A7"
$legendBrush2 = New-Brush "#E27494"
$legendBrush3 = New-Brush "#F0C36D"
$legendBrush4 = New-Brush "#88A8E8"
$g.FillEllipse($legendBrush4, 72, $legendY, 16, 16)
$g.DrawString("Main comparison path", $smallFont, $bodyBrush, 96, $legendY - 2)
$g.FillEllipse($legendBrush3, 330, $legendY, 16, 16)
$g.DrawString("Insertion / extra branch", $smallFont, $bodyBrush, 354, $legendY - 2)
$g.FillEllipse($legendBrush2, 620, $legendY, 16, 16)
$g.DrawString("Hard-error / mismatch branch", $smallFont, $bodyBrush, 644, $legendY - 2)
$g.FillEllipse($legendBrush1, 980, $legendY, 16, 16)
$g.DrawString("Matched branch", $smallFont, $bodyBrush, 1004, $legendY - 2)

$legendBrush1.Dispose()
$legendBrush2.Dispose()
$legendBrush3.Dispose()
$legendBrush4.Dispose()
$titleBrush.Dispose()
$bodyBrush.Dispose()
$mutedBrush.Dispose()
$branchBrush.Dispose()
$titleFont.Dispose()
$bodyFont.Dispose()
$smallFont.Dispose()
$heroFont.Dispose()
$subFont.Dispose()

$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output "Saved: $outputPath"
