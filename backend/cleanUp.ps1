Get-ChildItem bin -Recurse | Where{$_.Name -Match ".+\.(d\.t|j)s"} | Remove-Item
Get-ChildItem lib -Recurse | Where{$_.Name -Match ".+\.(d\.t|j)s"} | Remove-Item
Get-ChildItem ../local-config -Recurse | Where{$_.Name -Match ".+\.(d\.t|j)s"} | Remove-Item
Get-ChildItem test -Recurse | Where{$_.Name -Match ".+\.(d\.t|j)s"} | Remove-Item
Get-ChildItem cdk.out -Recurse | Remove-Item -Recurse -Force -Confirm:$false
if (Test-Path -Path cdk.out) {
    Remove-Item cdk.out
}
Get-ChildItem coverage -Recurse | Remove-Item -Recurse -Force -Confirm:$false
if (Test-Path -Path coverage) {
    Remove-Item coverage
}
Get-ChildItem target -Recurse | Remove-Item -Recurse -Force -Confirm:$false
if (Test-Path -Path target) {
    Remove-Item target
}