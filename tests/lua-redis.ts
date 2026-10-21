// Executes the production Lua scripts in a Lua VM, with the small Redis command
// subset they use supplied by an in-memory test adapter. No provider credentials.
import { createRequire } from 'node:module';
import type { RedisCommands } from '../server/redis-gateway';
const loadPackage = createRequire(import.meta.url);
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = loadPackage('fengari');
export function luaRedis(): RedisCommands & { advance: (ms: number) => void } {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  function push(value: unknown) {
    if (value === null || value === undefined) lua.lua_pushnil(state);
    else if (typeof value === 'string') lua.lua_pushstring(state, to_luastring(value));
    else if (typeof value === 'number') lua.lua_pushnumber(state, value);
    else if (typeof value === 'boolean') lua.lua_pushboolean(state, value);
    else {
      lua.lua_newtable(state);
      for (const [key, item] of Object.entries(value)) {
        push(item);
        if (Array.isArray(value)) lua.lua_rawseti(state, -2, Number(key) + 1);
        else lua.lua_setfield(state, -2, to_luastring(key));
      }
    }
  }
  function read(index: number): unknown {
    const absolute = lua.lua_absindex(state, index);
    switch (lua.lua_type(state, absolute)) {
      case lua.LUA_TNIL:
        return null;
      case lua.LUA_TBOOLEAN:
        return lua.lua_toboolean(state, absolute);
      case lua.LUA_TNUMBER:
        return lua.lua_tonumber(state, absolute);
      case lua.LUA_TSTRING:
        return to_jsstring(lua.lua_tolstring(state, absolute));
      case lua.LUA_TTABLE: {
        const length = lua.lua_rawlen(state, absolute);
        if (length) {
          const values: unknown[] = [];
          for (let i = 1; i <= length; i++) {
            lua.lua_rawgeti(state, absolute, i);
            values.push(read(-1));
            lua.lua_pop(state, 1);
          }
          return values;
        }
        const object: Record<string, unknown> = {};
        lua.lua_pushnil(state);
        while (lua.lua_next(state, absolute)) {
          object[String(read(-2))] = read(-1);
          lua.lua_pop(state, 1);
        }
        return object;
      }
      default:
        throw Error('Unexpected Lua value');
    }
  }
  lua.lua_newtable(state);
  lua.lua_pushcfunction(state, () => {
    push(JSON.parse(String(read(1))));
    return 1;
  });
  lua.lua_setfield(state, -2, to_luastring('decode'));
  lua.lua_pushcfunction(state, () => {
    push(JSON.stringify(read(1)));
    return 1;
  });
  lua.lua_setfield(state, -2, to_luastring('encode'));
  lua.lua_setglobal(state, to_luastring('cjson'));
  function run(script: string, keys: unknown[] = [], args: unknown[] = []): unknown {
    push(keys);
    lua.lua_setglobal(state, to_luastring('KEYS'));
    push(args);
    lua.lua_setglobal(state, to_luastring('ARGV'));
    if (
      lauxlib.luaL_loadstring(state, to_luastring(script)) !== lua.LUA_OK ||
      lua.lua_pcall(state, 0, 1, 0) !== lua.LUA_OK
    ) {
      const error = read(-1);
      lua.lua_pop(state, 1);
      throw Error(String(error));
    }
    const value = read(-1);
    lua.lua_pop(state, 1);
    return value;
  }
  run(`
    clock = ${Date.now()}.0
    strings = {}; hashes = {}; sets = {}; expires = {}
    redis = {call = function(cmd, ...)
      local a = {...}
      local key = a[1]
      if key and expires[key] and expires[key] <= clock then strings[key]=nil; sets[key]=nil; expires[key]=nil end
      if cmd == 'TIME' then return {math.floor(clock / 1000), (clock % 1000) * 1000} end
      if cmd == 'GET' then return strings[key] or false end
      if cmd == 'SET' then strings[key]=tostring(a[2]); if a[3]=='PX' then expires[key]=clock+tonumber(a[4]) end; return 'OK' end
      if cmd == 'EXISTS' then return strings[key] and 1 or 0 end
      if cmd == 'DEL' then strings[key]=nil;expires[key]=nil;return 1 end
      if cmd == 'EXPIRE' then expires[key]=clock+tonumber(a[2])*1000.0;return 1 end
      if cmd == 'HGET' then return hashes[key] and hashes[key][a[2]] or false end
      if cmd == 'HSET' then hashes[key]=hashes[key] or {};hashes[key][a[2]]=a[3];return 1 end
      if cmd == 'HDEL' then hashes[key][a[2]]=nil;return 1 end
      sets[key]=sets[key] or {}
      if cmd == 'ZADD' then sets[key][a[3]]=tonumber(a[2]);return 1 end
      if cmd == 'ZREM' then sets[key][a[2]]=nil;return 1 end
      if cmd == 'ZREMRANGEBYSCORE' then for member,score in pairs(sets[key]) do if score<=tonumber(a[3]) then sets[key][member]=nil end end;return 1 end
      if cmd == 'ZCARD' then local n=0;for _ in pairs(sets[key]) do n=n+1 end;return n end
      if cmd == 'ZCOUNT' then local n=0;local min=tonumber(string.sub(a[2],2));for _,score in pairs(sets[key]) do if score>min then n=n+1 end end;return n end
      if cmd == 'ZRANGE' then
        local rows={};for member,score in pairs(sets[key]) do table.insert(rows,{member,score}) end
        table.sort(rows,function(a,b) if a[2]==b[2] then return a[1]<b[1] end;return a[2]<b[2] end)
        local result={};for i=tonumber(a[2])+1,tonumber(a[3])+1 do if rows[i] then table.insert(result,rows[i][1]) end end;return result
      end
      error('Unsupported test Redis command: '..cmd)
    end}
    return true
  `);
  return {
    advance(ms) {
      run(`clock = clock + ${ms}; return true`);
    },
    async command(args) {
      if (args[0] === 'EVAL') {
        const count = Number(args[2]);
        return run(String(args[1]), args.slice(3, 3 + count), args.slice(3 + count));
      }
      const value = run(`return redis.call('${args[0]}', table.unpack(ARGV))`, [], args.slice(1));
      return value === false ? null : value;
    },
  };
}
