export function getPosition(): Promise<{
	latitude: number;
	longitude: number;
	accuracy: number | null;
}> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error("Geolocation is not supported by this browser"));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(position) =>
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracy:
						typeof position.coords.accuracy === "number"
							? position.coords.accuracy
							: null,
				}),
			(error) => {
				// code 1 = permission denied, 2 = position unavailable, 3 = timeout
				const message =
					error.code === 1
						? "Location permission was denied — enable it for this site to clock in"
						: "Could not get your location — make sure location services are on and try again";
				reject(new Error(message));
			},
			{ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
		);
	});
}
