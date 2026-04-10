import numpy as np
from flask import Flask, render_template, request

app = Flask(__name__)
datasets = ["blobs", "circles", "lines", "moons", "uniform"]

STATE = None


def to_snapshot(state):
    """
    Return the current clustering state in JSON-safe form.
    """
    return {
        "dataset": state["dataset"],
        "n_clusters": state["n_clusters"],
        "step": state["step"],
        "points": state["points"].tolist(),
        "centroids": state["centroids"].tolist(),
        "labels": state["labels"].tolist(),
        "converged": state["converged"]
    }


def generate_dataset(name, n_points=200, seed=42):
    """
    Generate one of the supported datasets as an (n, 2) numpy array.
    """
    rng = np.random.default_rng(seed)

    if name == "uniform":
        x = rng.uniform(-5, 5, n_points)
        y = rng.uniform(-5, 5, n_points)
        return np.column_stack((x, y))

    if name == "lines":
        n_half = n_points // 2
        x1 = rng.uniform(-5, 5, n_half)
        y1 = x1 + rng.normal(0, 0.5, n_half)

        x2 = rng.uniform(-5, 5, n_points - n_half)
        y2 = -x2 + rng.normal(0, 0.5, n_points - n_half)

        x = np.concatenate((x1, x2))
        y = np.concatenate((y1, y2))
        return np.column_stack((x, y))

    if name == "blobs":
        centers = np.array([
            [-3.5, -1.5],
            [0.0, 3.5],
            [3.5, -2.0]
        ])
        pts_per_blob = n_points // len(centers)
        parts = []

        for center in centers:
            part = center + rng.normal(0, 0.8, (pts_per_blob, 2))
            parts.append(part)

        points = np.vstack(parts)

        while len(points) < n_points:
            extra = centers[0] + rng.normal(0, 0.8, (1, 2))
            points = np.vstack((points, extra))

        return points

    if name == "circles":
        n_outer = n_points // 2
        n_inner = n_points - n_outer

        theta_outer = rng.uniform(0, 2 * np.pi, n_outer)
        theta_inner = rng.uniform(0, 2 * np.pi, n_inner)

        outer = np.column_stack((
            3 * np.cos(theta_outer),
            3 * np.sin(theta_outer)
        ))

        inner = np.column_stack((
            1.5 * np.cos(theta_inner),
            1.5 * np.sin(theta_inner)
        ))

        points = np.vstack((outer, inner))
        noise = rng.normal(0, 0.15, points.shape)
        return points + noise

    if name == "moons":
        n_top = n_points // 2
        n_bottom = n_points - n_top

        theta_top = rng.uniform(0, np.pi, n_top)
        theta_bottom = rng.uniform(0, np.pi, n_bottom)

        top = np.column_stack((
            np.cos(theta_top),
            np.sin(theta_top)
        ))

        bottom = np.column_stack((
            1 - np.cos(theta_bottom),
            -np.sin(theta_bottom) - 0.5
        ))

        points = np.vstack((top, bottom))
        noise = rng.normal(0, 0.08, points.shape)
        return 3 * (points + noise)

    raise ValueError(f"Unknown dataset: {name}")


def assign_labels(points, centroids):
    """
    Assign each point to its nearest centroid.
    """
    distances = np.linalg.norm(
        points[:, np.newaxis, :] - centroids[np.newaxis, :, :],
        axis=2
    )
    return np.argmin(distances, axis=1)


def recompute_centroids(points, labels, old_centroids):
    """
    Recompute centroids as the mean of assigned points.
    If a cluster gets no points, keep its old centroid.
    """
    new_centroids = []

    for i in range(len(old_centroids)):
        cluster_points = points[labels == i]
        if len(cluster_points) == 0:
            new_centroids.append(old_centroids[i])
        else:
            new_centroids.append(cluster_points.mean(axis=0))

    return np.array(new_centroids)


def make_state(dataset, n_clusters, centroids=None):
    """
    Create a fresh clustering state for a dataset and cluster count.
    """
    points = generate_dataset(dataset)
    n_clusters = int(n_clusters)

    if centroids is None or len(centroids) != n_clusters:
        rng = np.random.default_rng(123)
        chosen = rng.choice(len(points), size=n_clusters, replace=False)
        centroids = points[chosen]
    else:
        centroids = np.array(centroids, dtype=float)

    labels = assign_labels(points, centroids)

    state = {
        "dataset": dataset,
        "n_clusters": n_clusters,
        "points": points,
        "centroids": centroids,
        "labels": labels,
        "step": 0,
        "converged": False,
        "history": []
    }

    state["history"].append({
        "centroids": centroids.copy(),
        "labels": labels.copy(),
        "step": 0,
        "converged": False
    })

    return state


def load_history_snapshot(state, snap):
    """
    Copy a saved history snapshot back into the current state.
    """
    state["centroids"] = snap["centroids"].copy()
    state["labels"] = snap["labels"].copy()
    state["step"] = snap["step"]
    state["converged"] = snap["converged"]


@app.route("/")
def index():
    return render_template("index.html", datasets=datasets)


@app.route("/api/init", methods=["POST"])
def init_kmeans():
    """
    Initialize dataset, centroids, labels, and step count.
    """
    global STATE

    request_data = request.get_json()
    dataset = request_data["dataset"]
    n_clusters = request_data["n_clusters"]
    centroids = request_data.get("centroids")

    STATE = make_state(dataset, n_clusters, centroids)
    return to_snapshot(STATE)


@app.route("/api/step", methods=["POST"])
def step_kmeans():
    """
    Take one forward step of k-means.
    """
    global STATE

    if STATE is None:
        return {"error": "Initialize first."}, 400

    old_centroids = STATE["centroids"].copy()
    labels = assign_labels(STATE["points"], old_centroids)
    new_centroids = recompute_centroids(
        STATE["points"], labels, old_centroids
    )
    new_labels = assign_labels(STATE["points"], new_centroids)

    STATE["centroids"] = new_centroids
    STATE["labels"] = new_labels
    STATE["step"] += 1
    STATE["converged"] = np.allclose(old_centroids, new_centroids)

    STATE["history"].append({
        "centroids": new_centroids.copy(),
        "labels": new_labels.copy(),
        "step": STATE["step"],
        "converged": STATE["converged"]
    })

    return to_snapshot(STATE)


@app.route("/api/back", methods=["POST"])
def back_kmeans():
    """
    Go one step backward in the saved history.
    """
    global STATE

    if STATE is None:
        return {"error": "Initialize first."}, 400

    if len(STATE["history"]) <= 1:
        return to_snapshot(STATE)

    STATE["history"].pop()
    previous = STATE["history"][-1]
    load_history_snapshot(STATE, previous)

    return to_snapshot(STATE)


@app.route("/api/run", methods=["POST"])
def run_kmeans():
    """
    Run k-means until convergence or a max iteration limit.
    """
    global STATE

    if STATE is None:
        return {"error": "Initialize first."}, 400

    max_iters = 100

    while not STATE["converged"] and STATE["step"] < max_iters:
        old_centroids = STATE["centroids"].copy()
        labels = assign_labels(STATE["points"], old_centroids)
        new_centroids = recompute_centroids(
            STATE["points"], labels, old_centroids
        )
        new_labels = assign_labels(STATE["points"], new_centroids)

        STATE["centroids"] = new_centroids
        STATE["labels"] = new_labels
        STATE["step"] += 1
        STATE["converged"] = np.allclose(old_centroids, new_centroids)

        STATE["history"].append({
            "centroids": new_centroids.copy(),
            "labels": new_labels.copy(),
            "step": STATE["step"],
            "converged": STATE["converged"]
        })

    return to_snapshot(STATE)


@app.route("/api/reset", methods=["POST"])
def reset_kmeans():
    """
    Reset the current dataset to step 0 using current settings.
    """
    global STATE

    if STATE is None:
        return {"error": "Initialize first."}, 400

    dataset = STATE["dataset"]
    n_clusters = STATE["n_clusters"]
    STATE = make_state(dataset, n_clusters)

    return to_snapshot(STATE)


if __name__ == "__main__":
    app.run(debug=True)
