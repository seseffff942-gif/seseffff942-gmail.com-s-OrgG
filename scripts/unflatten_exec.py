import sqlite3, json

def unflatten(parsed):
    if not isinstance(parsed, list):
        return parsed
    root = parsed[0]
    def resolve(val):
        if isinstance(val, int):
            if 0 <= val < len(parsed):
                return resolve(parsed[val])
            return val
        if isinstance(val, list):
            return [resolve(x) for x in val]
        if isinstance(val, dict):
            return {k: resolve(v) for k, v in val.items()}
        return val
    # To avoid infinite recursion, build memo
    memo = {}
    def resolve_memo(idx):
        if not (isinstance(idx, int) and 0 <= idx < len(parsed)):
            return idx
        if idx in memo:
            return memo[idx]
        raw_val = parsed[idx]
        if isinstance(raw_val, dict):
            res = {}
            memo[idx] = res
            for k, v in raw_val.items():
                if isinstance(v, int):
                    res[k] = resolve_memo(v)
                elif isinstance(v, list):
                    res[k] = [resolve_memo(x) if isinstance(x, int) else x for x in v]
                else:
                    res[k] = v
            return res
        elif isinstance(raw_val, list):
            res = []
            memo[idx] = res
            for x in raw_val:
                res.append(resolve_memo(x) if isinstance(x, int) else x)
            return res
        else:
            memo[idx] = raw_val
            return raw_val

    return resolve_memo(0)

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId = 1422")
eid, data_str = c.fetchone()
obj = unflatten(json.loads(data_str))

# Find the HTTP request node to Evolution API
run_data = obj.get('resultData', {}).get('runData', {})
for node, runs in run_data.items():
    if 'WhatsApp' in node:
        for r in runs:
            data_in = r.get('data', {}).get('main', [[]])[0]
            if data_in:
                item = data_in[0].get('json', {})
                print(f"Node: {node}")
                print("param_caption:")
                print(item.get('param_caption'))
                print("to_phone:", item.get('to_phone'))

