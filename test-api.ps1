# Configurar los headers
$headers = @{
    'Content-Type' = 'application/json'
}

# Función para hacer una petición al modelo
function Invoke-LlamaRequest {
    param (
        [string]$Content,
        [int]$MaxTokens = 100
    )

    $body = @{
        messages = @(
            @{
                role = 'user'
                content = $Content
            }
        )
        max_tokens = $MaxTokens
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:3001/v1/chat/completions' -Method Post -Headers $headers -Body $body
        Write-Host "Respuesta recibida:" -ForegroundColor Green
        Write-Host $response.choices[0].message.content
        Write-Host "`nTokens utilizados:" -ForegroundColor Cyan
        Write-Host "- Prompt: $($response.usage.prompt_tokens)"
        Write-Host "- Completion: $($response.usage.completion_tokens)"
        Write-Host "- Total: $($response.usage.total_tokens)"
    }
    catch {
        Write-Host "Error en la petición:" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# Ejemplos de uso
Write-Host "=== Test de API LLaMA ===" -ForegroundColor Yellow
Write-Host "Enviando primera petición..." -ForegroundColor Cyan
Invoke-LlamaRequest -Content "Hola, ¿cómo estás?"

Start-Sleep -Seconds 2

Write-Host "`nEnviando segunda petición..." -ForegroundColor Cyan
Invoke-LlamaRequest -Content "¿Cuál es la capital de Francia?" -MaxTokens 200

Start-Sleep -Seconds 2

Write-Host "`nEnviando petición larga..." -ForegroundColor Cyan
Invoke-LlamaRequest -Content "Escribe un poema sobre la inteligencia artificial" -MaxTokens 500
