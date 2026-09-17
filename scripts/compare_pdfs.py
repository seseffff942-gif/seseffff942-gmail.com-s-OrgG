import re

def analyze(path):
    print("=== Analyzing", path, "===")
    with open(path, 'rb') as f:
        data = f.read()
    
    # Check pdf objects
    xobjects = re.findall(rb'/Subtype\s*/Image', data)
    print("Total Image XObjects:", len(xobjects))
    
    # Look for any text strings mentioning logo or png or storage
    for match in re.finditer(rb'([a-zA-Z0-9_\-\.\/:]+(?:logo|agricovet|storage|png|jpg)[a-zA-Z0-9_\-\.\/:]*)', data, re.IGNORECASE):
        print("  Found string:", match.group(0).decode('utf-8', errors='ignore')[:100])

analyze(r'C:\Users\sesef\Downloads\factura-1160.pdf')
analyze(r'C:\Users\sesef\Downloads\factura-1162.pdf')
