$root = $PSScriptRoot
$port = 8765
$types = @{ '.mp4'='video/mp4'; '.webm'='video/webm'; '.html'='text/html'; '.js'='text/javascript'; '.css'='text/css'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'; '.svg'='image/svg+xml' }
$l = [Net.HttpListener]::new()
$l.Prefixes.Add("http://localhost:$port/")
$l.Start()
Write-Host "Kinetix site running at http://localhost:$port/  (press Ctrl+C to stop)"
Start-Process "http://localhost:$port/index.html"
while ($true) {
    $c = $l.GetContext()
    try {
        $rel = [uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/')).Replace('/', '\')
        if (-not $rel) { $rel = 'index.html' }
        $p = Join-Path $root $rel
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { $c.Response.StatusCode = 404; $c.Response.Close(); continue }
        $fs = [IO.File]::Open($p, 'Open', 'Read', 'ReadWrite')
        $len = $fs.Length; $start = 0; $end = $len - 1
        $rg = $c.Request.Headers['Range']
        if ($rg -match 'bytes=(\d+)-(\d*)') {
            $start = [int64]$Matches[1]
            if ($Matches[2]) { $end = [int64]$Matches[2] }
            $c.Response.StatusCode = 206
            $c.Response.AddHeader('Content-Range', "bytes $start-$end/$len")
        }
        $ct = $types[[IO.Path]::GetExtension($p).ToLower()]
        if ($ct) { $c.Response.ContentType = $ct }
        $c.Response.AddHeader('Accept-Ranges', 'bytes')
        $n = $end - $start + 1
        $c.Response.ContentLength64 = $n
        $fs.Position = $start
        $buf = New-Object byte[] 65536
        while ($n -gt 0) {
            $r = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $n))
            if ($r -le 0) { break }
            $c.Response.OutputStream.Write($buf, 0, $r)
            $n -= $r
        }
        $fs.Close(); $c.Response.Close()
    } catch { try { $c.Response.Abort() } catch {} }
}
