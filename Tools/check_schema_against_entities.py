import re
import os

with open('Database/DeployInit/001_schema.sql', 'r', encoding='utf-8') as f:
    sql_text = f.read()

table_pattern = re.compile(r'CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)\s*\((.*?)\);', re.DOTALL | re.IGNORECASE)
tables = {}
for m in table_pattern.finditer(sql_text):
    tname = m.group(1).lower()
    body = m.group(2)
    cols = []
    for line in body.split('\n'):
        line = line.strip()
        if not line or line.startswith('--') or line.upper().startswith('CONSTRAINT') or line.upper().startswith('UNIQUE') or line.upper().startswith('PRIMARY KEY') or line.upper().startswith('CHECK'):
            continue
        parts = line.split()
        if parts:
            cols.append(parts[0].lower().replace('"', ''))
    tables[tname] = cols

with open('Server/RaceGame.Infrastructure/Persistence/AppDbContext.cs', 'r', encoding='utf-8') as f:
    cs_text = f.read()

entity_block_pattern = re.compile(r'modelBuilder\.Entity<([a-zA-Z0-9_]+)>\(entity\s*=>\s*\{(.*?)\}\);', re.DOTALL)

mismatches = {}
for m in entity_block_pattern.finditer(cs_text):
    ename = m.group(1)
    body = m.group(2)
    
    tname_m = re.search(r'entity\.ToTable\(["\']([a-zA-Z0-9_]+)["\']\);', body)
    if not tname_m:
        continue
    tname = tname_m.group(1).lower()
    
    col_maps = dict(re.findall(r'entity\.Property\(x\s*=>\s*x\.([a-zA-Z0-9_]+)\)\s*\.HasColumnName\(["\']([a-zA-Z0-9_]+)["\']\)', body))
    sql_cols = set(tables.get(tname, []))
    
    domain_file = f'Server/RaceGame.Domain/Entities/{ename}.cs'
    if os.path.exists(domain_file):
        with open(domain_file, 'r', encoding='utf-8') as df:
            df_text = df.read()
            # 匹配 (类型, 属性名)
            props = re.findall(r'public\s+([a-zA-Z0-9_<>\?]+)\s+([a-zA-Z0-9_]+)\s*\{\s*get;', df_text)
            for p_type, prop in props:
                if prop == 'Id' and 'id' in sql_cols:
                    continue
                clean_type = p_type.replace('?', '').strip()
                if 'List<' in clean_type or 'ICollection<' in clean_type or clean_type in ['RanchEquipmentItem']:
                    continue
                if prop in col_maps:
                    col_name = col_maps[prop].lower()
                else:
                    # 严格按照 AppDbContext.ToSnakeCase 算法
                    chars = []
                    for i, ch in enumerate(prop):
                        has_prev = i > 0
                        has_next = i + 1 < len(prop)
                        if ch.isupper():
                            prev_is_lower_digit = has_prev and (prop[i-1].islower() or prop[i-1].isdigit())
                            next_is_lower = has_next and prop[i+1].islower()
                            if has_prev and (prev_is_lower_digit or next_is_lower):
                                chars.append('_')
                            chars.append(ch.lower())
                        elif ch.isdigit():
                            if has_prev and not prop[i-1].isdigit() and prop[i-1] != '_':
                                chars.append('_')
                            chars.append(ch)
                        else:
                            chars.append(ch)
                    col_name = "".join(chars)
                if col_name not in sql_cols:
                    mismatches.setdefault(tname, []).append((prop, col_name))

if not mismatches:
    print("SUCCESS: All domain entities match 001_schema.sql columns 100%!")
else:
    for tname, missing in mismatches.items():
        print(f"Table {tname}: missing columns {[c[1] for c in missing]}")
