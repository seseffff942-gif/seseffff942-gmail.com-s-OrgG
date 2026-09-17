import re

with open(r'C:\Users\sesef\Downloads\factura-1160.pdf', 'rb') as f:
    data1 = f.read()

with open(r'C:\Users\sesef\Downloads\factura-1162.pdf', 'rb') as f:
    data2 = f.read()

# Search for any references in the pdf
print("1160 size:", len(data1))
print("1162 size:", len(data2))

# Check occurrences of png or jpg or base64 or Stream
streams1 = re.findall(rb'/Filter\s*/DCTDecode|/Filter\s*/FlateDecode', data1)
print("1160 stream filters:", streams1)

streams2 = re.findall(rb'/Filter\s*/DCTDecode|/Filter\s*/FlateDecode', data2)
print("1162 stream filters:", streams2)
