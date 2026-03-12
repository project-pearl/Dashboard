"""
Gaussian Plume Projection — Storm Evacuation Planning Tool

Estimates downwind concentration spread from a point source (e.g. chemical
facility, fire, industrial release) to help identify areas in the plume path
that may need evacuation.

Usage:
  python scripts/gaussian-plume.py
"""

import numpy as np
import matplotlib.pyplot as plt


def gaussian_plume_simple(
    x, y,
    source_x=0, source_y=0,
    wind_dir_deg=270,
    wind_speed=5,
    Q=1,
    sigma_y=50,
    sigma_z=20,
):
    """
    Gaussian plume concentration at ground level (z=0).

    Parameters
    ----------
    x, y        : array-like, coordinates in metres
    source_x/y  : source location (m)
    wind_dir_deg: meteorological wind direction — the direction wind comes FROM
                  (270 = wind from west, plume travels east)
    wind_speed  : m/s
    Q           : emission rate (arbitrary units)
    sigma_y/z   : lateral / vertical dispersion coefficients (m)
    """
    # Direction the wind is BLOWING TOWARD (opposite of "from")
    blow_rad = np.deg2rad((wind_dir_deg + 180) % 360)

    dx = x - source_x
    dy = y - source_y

    # Rotate into wind-aligned coordinates
    x_rot = dx * np.cos(blow_rad) + dy * np.sin(blow_rad)   # downwind
    y_rot = -dx * np.sin(blow_rad) + dy * np.cos(blow_rad)  # crosswind

    conc = (Q / (2 * np.pi * wind_speed * sigma_y * sigma_z)) * np.exp(
        -0.5 * (y_rot / sigma_y) ** 2
    )

    # Zero out upwind side (x_rot < 0) — array-safe
    conc = np.where(x_rot > 0, conc, 0.0)
    return conc


# ── Grid setup ────────────────────────────────────────────────────────
x = np.linspace(-1000, 10000, 200)
y = np.linspace(-2000, 2000, 100)
X, Y = np.meshgrid(x, y)

wind_from_deg = 270   # wind FROM west → plume travels east
wind_speed_ms = 5     # m/s

conc = gaussian_plume_simple(X, Y, wind_dir_deg=wind_from_deg, wind_speed=wind_speed_ms)

# ── Plot ──────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
cf = ax.contourf(X, Y, conc, levels=20, cmap='OrRd')
fig.colorbar(cf, ax=ax, label='Relative Concentration')

# Wind arrow (direction plume travels)
ax.annotate(
    '', xy=(1500, 0), xytext=(0, 0),
    arrowprops=dict(arrowstyle='->', color='blue', lw=2),
)
ax.plot([], [], color='blue', label=f'Wind from {wind_from_deg}° at {wind_speed_ms} m/s')

ax.set_title('Gaussian Plume Projection — Evacuation Zone Estimate')
ax.set_xlabel('Distance (m)')
ax.set_ylabel('Crosswind (m)')
ax.legend(loc='upper right')
plt.tight_layout()
plt.savefig('plume_projection.png', dpi=150)
plt.show()

# ── Time-to-target ────────────────────────────────────────────────────
for dist_km in [1, 2, 5, 10]:
    dist_m = dist_km * 1000
    time_s = dist_m / wind_speed_ms
    time_min = time_s / 60
    print(f"  {dist_km:>2} km downwind: {time_min:>6.1f} min  ({time_s/3600:.2f} hr)")
