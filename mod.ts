import { existsSync } from 'https://deno.land/std@0.197.0/fs/mod.ts';

const MODULE_REGEX = /^(?:(?!\.).)*$/;

export default () => {
	const externalsCode: Record<string, Uint8Array> = {};
	
	const bundleExternal = (path: string) => {
		try {
			console.log(path);
			const command = new Deno.Command(Deno.execPath(), {
				args: ['bundle', path],
			});
			
			const { stdout } = command.outputSync();
			externalsCode[path] = stdout;
			return true;
		} catch (e) {
			console.error(`Error getting "${path}": ${e.message}`);
			return false;
		}
	};
	
	const onResolveHttp = args => {
		const ok = bundleExternal(args.path);
		if (!ok) return null;
		return {
			path: args.path,
			namespace: 'deno-loader',
		};
	};
	
	const onResolveModuleMap = args => {
		const [_currentPath, ...nextPath] = args.path.split('/');
		const currentPath = _currentPath + (nextPath.length ? '/' : '');
		
		console.log(currentPath);
		if (currentPath.match(MODULE_REGEX)) {
			const cwd = Deno.cwd();
			const denoPath = `${cwd}/deno.json`;
			if (!existsSync(denoPath)) {
				console.error(`deno.json not found in "${cwd}"`);
				return null;
			}
			
			const denoJson = JSON.parse(Deno.readTextFileSync(denoPath));
			const path = denoJson.imports[currentPath] + nextPath?.join('/');
			
			console.log(path);
			
			if (!bundleExternal(path)) return null;
			return {
				path: path,
				namespace: 'deno-loader',
			};
		}
		
		return null;
	};
	
	const onLoad = args => {
		return {
			contents: externalsCode[args.path],
			loader: 'js',
		};
	};
	
	const setup = build => {
		build.onResolve({ filter: /^https?:\/\// }, onResolveHttp);
		build.onResolve({ filter: /. */ }, onResolveModuleMap);
		build.onLoad({ filter: /.*/, namespace: 'deno-loader' }, onLoad);
	};
	
	return {
		name: 'deno-loader',
		setup,
	};
};
