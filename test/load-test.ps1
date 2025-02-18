# Test de carga para la API de LLama
$baseUrl = "http://localhost:3001"
$numRequests = 1  # Una sola petición
$delayBetweenBatches = 1  # Aumentado el delay

# Verificar estado del cluster primero
Write-Host "Verificando estado del cluster..."
try {
    $clusterStatus = Invoke-RestMethod -Uri "$baseUrl/api/cluster/status" -Method Get
    Write-Host "Estado del cluster:"
    Write-Host "- Nodos totales: $($clusterStatus.totalNodes)"
    Write-Host "- Nodos activos: $($clusterStatus.activeNodes)"
    
    if ($clusterStatus.activeNodes -eq 0) {
        Write-Host "ERROR: No hay nodos activos en el cluster" -ForegroundColor Red
        Write-Host "Por favor, asegúrate de que los nodos estén conectados antes de continuar"
        exit 1
    }
    
    Write-Host "Cluster OK - Continuando con las pruebas..." -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo obtener el estado del cluster" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Mensaje de prueba más corto para diagnóstico
$body = @{
    messages = @(
        @{
            role = "user"
            content = "Hola, ¿cómo estás?"
        }
    )
    model = "llama2"
    temperature = 0.7
    max_tokens = 100
} | ConvertTo-Json

# Función para realizar una solicitud individual con más detalles de error
function Make-Request {
    param($id)
    try {
        $start = Get-Date
        
        # Crear la solicitud con más detalles
        $params = @{
            Uri = "$baseUrl/v1/chat/completions"
            Method = 'Post'
            Body = $body
            ContentType = 'application/json'
            ErrorAction = 'Stop'
        }
        
        Write-Host "[$id] Enviando solicitud..."
        
        try {
            $response = Invoke-RestMethod @params
            $end = Get-Date
            $duration = ($end - $start).TotalSeconds
            
            return @{
                RequestId = $id
                Status = "Success"
                Duration = $duration
                Response = $response
            }
        }
        catch {
            # Capturar detalles completos del error
            try {
                $rawResponse = $_.ErrorDetails.Message
                if ($rawResponse) {
                    Write-Host "[$id] Error Response Body: $rawResponse" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "[$id] No se pudo leer el cuerpo de la respuesta de error" -ForegroundColor Yellow
            }
            
            throw "[$id] Status Code: $($_.Exception.Response.StatusCode.value__), Message: $($_.Exception.Message)"
        }
    }
    catch {
        return @{
            RequestId = $id
            Status = "Error"
            Error = $_.Exception.Message
        }
    }
}

# Estadísticas globales
$successful = 0
$failed = 0
$totalDuration = 0
$durations = @()

Write-Host "`nIniciando prueba de diagnóstico con $numRequests solicitudes..."
Write-Host "----------------------------------------"

# Ejecutar solicitudes en serie para mejor diagnóstico
1..$numRequests | ForEach-Object {
    $currentBatch = $_
    Write-Host "`nEjecutando solicitud $currentBatch de $numRequests"
    
    # Verificar estado del cluster antes de cada solicitud
    try {
        $status = Invoke-RestMethod -Uri "$baseUrl/api/cluster/status" -Method Get
        if ($status.activeNodes -eq 0) {
            throw "No hay nodos activos en el cluster"
        }
    } catch {
        Write-Host "ERROR: Cluster no disponible - Deteniendo pruebas" -ForegroundColor Red
        exit 1
    }
    
    $result = Make-Request -id $_
    
    if ($result.Status -eq "Success") {
        $successful++
        $totalDuration += $result.Duration
        $durations += $result.Duration
        Write-Host " Solicitud $($result.RequestId) completada en $($result.Duration.ToString("F2"))s" -ForegroundColor Green
    } else {
        $failed++
        Write-Host " Solicitud $($result.RequestId) falló: $($result.Error)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds $delayBetweenBatches
}

# Calcular estadísticas
$avgDuration = if ($successful -gt 0) { $totalDuration / $successful } else { 0 }
$minDuration = if ($durations.Count -gt 0) { ($durations | Measure-Object -Minimum).Minimum } else { 0 }
$maxDuration = if ($durations.Count -gt 0) { ($durations | Measure-Object -Maximum).Maximum } else { 0 }

# Mostrar resultados
Write-Host "`n----------------------------------------"
Write-Host "Resultados del test de diagnóstico:"
Write-Host "----------------------------------------"
Write-Host "Total de solicitudes: $numRequests"
Write-Host "Exitosas: $successful"
Write-Host "Fallidas: $failed"
Write-Host "Duración promedio: $($avgDuration.ToString("F2"))s"
Write-Host "Duración mínima: $($minDuration.ToString("F2"))s"
Write-Host "Duración máxima: $($maxDuration.ToString("F2"))s"
Write-Host "----------------------------------------"
