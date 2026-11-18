$ErrorActionPreference='Stop'
$evidence=([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'evidence-path.txt'))).Trim()
$keyFile='C:\Users\Wolfe\Backups\VITALISMEN_EC\BOOTSTRAP_BACKUP\20261114T181300Z\recovery\recovery-key.dpapi'
$private=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$rsa=[Security.Cryptography.RSA]::Create();$rsa.ImportFromPem([Text.Encoding]::UTF8.GetString($private))
$results=@()
try {
 foreach($item in @(@('BOOT_AFTER_V241.vbe','BOOT_AFTER_V241_CAPTURE.json','site'),@('SITE_AFTER_V241.vbe','SITE_AFTER_V241_CAPTURE.json','site'),@('RUNTIME_CONFIG_AFTER.vbe','PRIVATE_CONFIG_AFTER_CAPTURE.json','private_config'))){
  $proof=Get-Content (Join-Path $evidence $item[1]) -Raw|ConvertFrom-Json
  $packet=[IO.File]::ReadAllBytes((Join-Path $evidence $item[0]))
  $magic=[Text.Encoding]::ASCII.GetBytes("VITALISMEN_EC_BACKUP_V1`n")
  for($i=0;$i -lt $magic.Length;$i++){if($packet[$i] -ne $magic[$i]){throw 'BAD_ENVELOPE_MAGIC'}}
  $size=[byte[]]::new(4);[Buffer]::BlockCopy($packet,$magic.Length,$size,0,4);if([BitConverter]::IsLittleEndian){[Array]::Reverse($size)}
  $len=[BitConverter]::ToUInt32($size,0);if($len -gt 4096 -or $len -lt 100){throw 'BAD_HEADER'}
  $headerBytes=[byte[]]::new($len);[Buffer]::BlockCopy($packet,$magic.Length+4,$headerBytes,0,$len)
  $header=[Text.Encoding]::UTF8.GetString($headerBytes)|ConvertFrom-Json
  if($header.project -ne 'VITALISMEN_EC' -or $header.kind -ne $item[2]){throw 'BAD_SCOPE'}
  $start=$magic.Length+4+$len;$cipher=[byte[]]::new($packet.Length-$start-16);[Buffer]::BlockCopy($packet,$start,$cipher,0,$cipher.Length)
  $tag=[byte[]]::new(16);[Buffer]::BlockCopy($packet,$packet.Length-16,$tag,0,16)
  $key=$rsa.Decrypt([Convert]::FromBase64String($header.wrappedKey),[Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)
  $aes=[Security.Cryptography.AesGcm]::new($key,16);$plain=[byte[]]::new($cipher.Length)
  try {
   $aes.Decrypt([Convert]::FromBase64String($header.iv),$cipher,$tag,$plain,$headerBytes)
   $hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($plain)).ToLowerInvariant()
   if($hash -ne $proof.envelope.plaintextSha256){throw 'PLAINTEXT_HASH_MISMATCH'}
   $checks=[ordered]@{artifact=$item[0];decrypt='PASS';plaintextHash='PASS';plaintextWrittenToDisk=$false}
   if($item[2] -in @('site','dashboard')){
    Add-Type -AssemblyName System.Formats.Tar
    $ms=[IO.MemoryStream]::new($plain,$false);$gz=[IO.Compression.GZipStream]::new($ms,[IO.Compression.CompressionMode]::Decompress);$tar=[System.Formats.Tar.TarReader]::new($gz)
    try {
     $fileRecords=if($item[2] -eq 'site'){@($proof.files)}else{@($proof)}
     $count=0;while($null -ne ($entry=$tar.GetNextEntry())){
      $record=@($fileRecords|Where-Object {$_.path.TrimStart('/') -ceq $entry.Name})
      if($record.Count -ne 1 -or $null -eq $entry.DataStream){throw 'UNEXPECTED_TAR_ENTRY'}
      $digest=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($entry.DataStream)).ToLowerInvariant()
      if($digest -ne $record[0].sha256 -or $entry.Uid -ne $record[0].uid -or $entry.Gid -ne $record[0].gid -or [int]$entry.Mode -ne $record[0].mode){throw 'TAR_CONTENT_OR_METADATA_MISMATCH'}
      $count++
     }
     if($count -ne $fileRecords.Count){throw 'TAR_FILES_MISSING'};$checks.filesAndMetadata=($count.ToString()+'/ PASS')
    } finally {$tar.Dispose();$gz.Dispose();$ms.Dispose()}
   } else {
    $data=[Text.Encoding]::UTF8.GetString($plain)|ConvertFrom-Json -AsHashtable
    if($item[0] -eq 'MEASUREMENT_PRIVATE.vbe' -and ($data.dataset -ne '28298613626504767' -or -not $data.token -or -not $data.bridge)){throw 'PRIVATE_CONFIGURATION_INCOMPLETE'}
    if($item[0] -eq 'RUNTIME_CONFIG_AFTER.vbe' -and $data.project -ne 'VITALISMEN_EC'){throw 'RUNTIME_CONFIGURATION_SCOPE_MISMATCH'}
    $checks.requiredConfiguration='PASS';$data=$null
   }
   $damaged=[byte[]]$cipher.Clone();$damaged[0]=$damaged[0] -bxor 1;$rejected=$false
   try{$aes.Decrypt([Convert]::FromBase64String($header.iv),$damaged,$tag,[byte[]]::new($damaged.Length),$headerBytes)}catch [Security.Cryptography.CryptographicException]{$rejected=$true}
   if(-not $rejected){throw 'TAMPERING_NOT_REJECTED'};$checks.tamperRejected=$true
   $results+=$checks
  } finally {[Array]::Clear($key,0,$key.Length);[Array]::Clear($plain,0,$plain.Length);$aes.Dispose()}
 }
 $result=[ordered]@{project='VITALISMEN_EC';status='PASS_CODE_CONFIG_RECOVERY_ONLY';results=$results;privateKeyUploaded=$false;productionRestoration=$false;globalDataBackupPass=$false}
 $json=$result|ConvertTo-Json -Depth 6;[IO.File]::WriteAllText((Join-Path $evidence 'CODE_CONFIG_RECOVERY_AFTER.json'),$json,[Text.UTF8Encoding]::new($false));$json
}finally{[Array]::Clear($private,0,$private.Length);$rsa.Dispose()}
